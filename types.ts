// =============================================================================
// JIGG SPEC — types.ts
// =============================================================================

export type HexCode     = string;
export type SpecVersion = `${number}.${number}`;
export type ImageSource = "embedded" | "url";
export type EdgeType    = "corner" | "edge" | "interior";

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
  edgeType: EdgeType;
  canonical: {
    x: number;
    y: number;
    rot: 0;
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
  puzzleUri: JiggUri;
  specVersion: SpecVersion;
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
  z?: number;
  /**
   * Authoritative. Generated at snap time (NanoID 8).
   * Absent = unconnected.
   * placed === true implies clusterId is absent.
   * Engine MUST enforce this invariant immediately on transition.
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
  view: {
    camera: { x: number; y: number; zoom: number };
  };
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
