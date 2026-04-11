// =============================================================================
// JIGG SPEC — types.ts
// =============================================================================

export type HexCode     = string;
export type SpecVersion = `${number}.${number}`;
export type ImageSource = "embedded" | "url";
export type EdgeType    = "corner" | "edge" | "interior";

type JiggUriType = "artist" | "org" | "puzzle" | "state";
export type JiggUri = `jigg:${JiggUriType}:${string}`;

export interface Point {
  x: number;
  y: number;
}

export const STAGE_TABLE = "table" as const;
export const STAGE_BENCH = "bench" as const;
export type StageId =
  | typeof STAGE_TABLE
  | typeof STAGE_BENCH
  | string;

export interface Attribution {
  role: "artist" | "illustrator" | "photographer" | "publisher" | "brand" | string;
  name: string;
  uri?: JiggUri;
}

export interface JiggSawManifest {
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
  manifest: JiggSawManifest;
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

export type RotationConfig =
  | { mode: "cardinal"; value: 0 | 1 | 2 | 3 }
  | { mode: "free";     value: number };

export interface PieceState {
  id: string;
  stageId: StageId;
  pos?: Point;
  rot?: number;
  z?: number;
  clusterId?: string;
  placed?: boolean;
}

export interface JiggAssembly {
  specVersion: SpecVersion;
  rotation: RotationConfig;
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
  completed: boolean;
  lastSavedAt?: string;
}

export interface Jigg {
  mimetype: "application/jigg+zip";
  header: JiggHeader;
  puzzle: JiggSaw;
  state?: JiggState;
}
