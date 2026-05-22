declare module "archiver" {
  import type { Transform } from "stream";
  import type { ZlibOptions } from "zlib";

  export interface ZipArchiveOptions {
    zlib?: ZlibOptions;
    comment?: string;
    forceLocalTime?: boolean;
    forceZip64?: boolean;
    namePrependSlash?: boolean;
    store?: boolean;
  }

  export class ZipArchive extends Transform {
    constructor(options?: ZipArchiveOptions);
    directory(dirpath: string, destpath: false | string): this;
    finalize(): Promise<void>;
  }
}
