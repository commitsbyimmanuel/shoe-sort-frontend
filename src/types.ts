// types.ts
export type MatchResult = {
  pair: string; // e.g., "B2-B8"
  probability: number; // 0..1
  meta?: Record<string, any>;
};

// export type ApiResponse =
//   | { status: "error"; message?: string }
//   | {
//       status: "pair_found";
//       pair_location: string;
//       pair_image_data_url?: string;
//       pair_image_url?: string;
//       cosine_similarity?: number;
//       reason?: string;
//     }
//   | { status: "add_to_set"; location: string; clientId: string };

export type ApiResponse =
  | { status?: "error"; message: string }
  | Record<string, any>;

export type PairSide = {
  grid: string;
  location: string;
  filename: string;
};
export type PairItem = {
  pair_id: string;
  i: number;
  j: number;
  sim: number;
  left: PairSide;
  right: PairSide;
};

export type SingleItem = {
  grid: string;
  location: string;
  filename: string;
};

export type ComputeResult = {
  scope: string; // "global"
  compute_id: string;
  grids: string[];
  counts_by_grid: Record<string, number>;
  pairs: PairItem[];
  singles: SingleItem[];
};

export type ComputeResponse = {
  ok: boolean;
  results: ComputeResult[];
};

export type FeedbackVars = {
  compute_id: string;
  pair_id: string;
  correct: boolean;
};
