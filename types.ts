// =============================================================================
// JIGG SPEC — types.ts
//
// These types define the PERSISTED shape of jigg data. Runtime enrichments
// (single-piece groups, bench layout, camera state) are engine-internal and
// deliberately have no types here — see "Runtime / persistence boundary" in
// the spec (§7).
// =============================================================================

export type HexCode     = string;

/**
 * `{major}.{minor}`. Major carries the compatibility contract (§10) —
 * engines compare majors only. Minor increments on additive change and is
 * informational.
 */
export type SpecVersion = `${number}.${number}`;

export type ImageSource = "embedded" | "url";

type CoreUriType = "artist" | "org" | "puzzle" | "state";
type ExtensionUriType = `${string}.${string}`;
export type JiggUri = `jigg:${CoreUriType | ExtensionUriType}:${string}`;

export interface Point {
  x: number;
  y: number;
}

export const STAGE_TABLE = "table" as const;
export const STAGE_BENCH = "bench" as const;
export type UserStageId = string;
export type StageId =
  | typeof STAGE_TABLE
  | typeof STAGE_BENCH
  | UserStageId;

export type KnownAttributionRole =
  | "artist"
  | "illustrator"
  | "photographer"
  | "publisher"
  | "brand";

export type AttributionRole = KnownAttributionRole | (string & {});

export interface Attribution {
  role: AttributionRole;
  name: string;
  uri?: JiggUri;
}

export interface JiggManifest {
  uri: JiggUri;
  specVersion: SpecVersion;
  title: string;
  aspectRatio?: number;
  attributions?: Attribution[];
  credit?: string;
  license?: string;
  cutStyle?: "whimsy";
  image: {
    source: ImageSource;
    path: string;
    width: number;
    height: number;
  };
  integrity: {
    dissection?: string;
    image: string;
    thumbnail?: string;
  };
}

export interface JiggSaw {
  mimetype: "application/jiggsaw+zip";
  manifest: JiggManifest;
  dissection?: JiggDissection;
  assets: Record<string, ArrayBuffer>;
}

export interface PieceTemplate {
  id: string;
  path: string;
  width: number;
  height: number;
  anchorPoint: Point;
}

export interface PieceDefinition {
  id: string;
  templateId: string;
  edges: {
    top: "flat" | "tab" | "blank";
    right: "flat" | "tab" | "blank";
    bottom: "flat" | "tab" | "blank";
    left: "flat" | "tab" | "blank";
  };
  canonical: {
    x: number;
    y: number;
  };
  index: number;
  meanColor: HexCode;
  whimsyId?: string;
}

export interface WhimsyDefinition {
  id: string;
  name: string;
}

export interface JiggDissection {
  /**
   * Binding to the puzzle this cut belongs to. References JiggManifest.uri.
   * Second identity anchor alongside JiggGlue.puzzleUri — a dissection is
   * never valid against a different puzzle.
   */
  puzzleUri: JiggUri;
  specVersion: SpecVersion;
  image: {
    width: number;
    height: number;
  };
  palette: HexCode[];
  pieces: PieceDefinition[];
  templates: Record<string, PieceTemplate>;
  whimsies?: Record<string, WhimsyDefinition>;
}

/**
 * Named after puzzle glue — the physical product used to seal and preserve
 * a completed jigsaw. JiggGlue permanently binds a playthrough to its puzzle.
 * Written once at game creation, never mutated.
 */
export interface JiggGlue {
  uri: JiggUri;
  puzzleUri: JiggUri;
  manifestHash: string;
  createdAt: string;
}

export interface StageDefinition {
  id: StageId;
  name: string;
}

export interface PieceState {
  id: string;
  stageId: StageId;
  /**
   * Position in a single global coordinate space.
   * MUST be present iff stageId !== STAGE_BENCH.
   * Absent for STAGE_BENCH — engine owns bench layout and does not persist it.
   * Bench pieces do not have a position and do not participate in the
   * coordinate space until extracted.
   * For transitions between non-bench stages, MUST NOT be transformed —
   * stage changes are logical only.
   * Exception: cluster merge operations may recompute pos of absorbed pieces
   * to maintain rigid group structure. The surviving cluster's origin piece
   * (lowest PieceDefinition.index) MUST remain fixed in world space.
   */
  pos?: Point;
  /**
   * Degrees. Must be one of {0, 90, 180, 270}.
   * Always present, including bench pieces.
   * Assigned randomly at game creation. Carries over unchanged on extraction
   * from bench. Engines MUST write only normalized values — normalization on
   * load is a safety net for invalid or legacy data only.
   */
  rot: number;
  /**
   * Stacking order within the global coordinate space. Higher renders above.
   * MUST be absent for STAGE_BENCH pieces — bench pieces do not participate
   * in the coordinate space, stacking included (same rule as pos).
   * Optional elsewhere: absent = engine-defined order. Engines that persist
   * z SHOULD renormalize to a dense sequence on save so values do not grow
   * unboundedly. Pieces within a cluster share the cluster's stacking level;
   * relative z within a cluster is not meaningful.
   */
  z?: number;
  /**
   * PERSISTED SEMANTICS: presence encodes a fact — this piece is physically
   * connected to at least one other. Absent = unconnected. It does not
   * encode group membership.
   *
   * Generated at snap time (NanoID 8). Authoritative — never derived from
   * the spatial graph.
   *
   * Runtime / persistence boundary (§7): engines MAY model unconnected
   * table pieces as single-piece groups at runtime for a uniform operation
   * interface. Those runtime IDs MUST NOT reach this field — the save
   * boundary omits clusterId for any unplaced piece whose runtime group has
   * exactly one member. The strip is a projection: the live model is not
   * mutated. Load MAY reconstruct single-piece groups; reconstruction is
   * engine-internal.
   *
   * Invariant P1: placed === true implies clusterId is absent.
   * Engine MUST enforce immediately on transition.
   * MUST be absent for STAGE_BENCH pieces — no clustering on bench.
   * MUST be absent for all pieces at game creation.
   */
  clusterId?: string;
  placed: boolean;
}

export interface JiggAssembly {
  specVersion: SpecVersion;
  playTimeSeconds?: number;
  palette?: HexCode[];
  stages: StageDefinition[];
  pieces: PieceState[];
  // view/camera state is deliberately NOT part of the format.
  // It is device-scoped, not playthrough-scoped — engines persist it
  // locally, keyed by JiggGlue.uri.
}

export interface JiggState {
  mimetype: "application/jiggstate+zip";
  glue: JiggGlue;
  dissection: JiggDissection;
  assembly: JiggAssembly;
}

export interface JiggHeader {
  uri: JiggUri;
  specVersion: SpecVersion;
  title: string;
  displayCredit?: string;
  aspectRatio?: number;
  pieceCount: number;
  placedCount: number;
  /**
   * 1 - (clusterCount - 1) / (pieceCount - 1), clamped to [0, 1];
   * 1.0 when pieceCount === 1.
   * clusterCount (see §7): distinct persisted clusterIds
   *   + unplaced pieces with no clusterId (each its own unit)
   *   + 1 if any piece is placed (the solved region is one unit).
   */
  assemblyProgress?: number;
  playTimeSeconds?: number;
  /**
   * SHA-256 of assembly.json, computed over its exact byte contents
   * as stored in the archive (no reformatting, normalization, or parsing).
   * Absent if never saved.
   */
  assemblyHash?: string;
  lastSavedAt?: string;
  // completed is derived: placedCount === pieceCount
}

export interface Jigg {
  mimetype: "application/jigg+zip";
  header: JiggHeader;
  puzzle: JiggSaw;
  state?: JiggState;
}