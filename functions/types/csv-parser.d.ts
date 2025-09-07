declare module "csv-parser" {
  import { Transform } from "stream";

  interface Options {
    separator?: string;
    headers?: string[] | boolean;
    skipLines?: number;
  }

  export default function csvParser(options?: Options): Transform;
}
