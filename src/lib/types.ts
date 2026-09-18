export type ArtworkImage = {
  primary: string;
  small: string;
};

export type Artwork = {
  id: number;
  title: string;
  artist: string | null;
  date: string | null;
  medium: string | null;
  image: ArtworkImage;
  isPublicDomain: true;
  objectURL: string | null;
};

export type SubjectConfig = {
  slug: string;
  defaultTitle: string;
  published: boolean;
  defaultArtworkIds: number[];
  artworkIds: number[];
  notes?: string;
};

export type SubjectsFile = {
  defaultSubject: string;
  subjects: SubjectConfig[];
};

export type ExhibitionSuccess = {
  ok: true;
  subject: string;
  title: string;
  artworks: Artwork[];
};

export type ExhibitionErrorCode =
  | "invalid_subject"
  | "insufficient_content"
  | "upstream_error";

export type ExhibitionError = {
  ok: false;
  error: ExhibitionErrorCode;
  message: string;
};

export type ExhibitionResponse = ExhibitionSuccess | ExhibitionError;
