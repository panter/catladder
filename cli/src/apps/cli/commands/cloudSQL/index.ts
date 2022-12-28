import type Vorpal from "vorpal";
//import commandInitProject from "./commandInitProject.old";

import commandRestoreDb from "./commandRestoreDb";

export default async (vorpal: Vorpal) => {
  commandRestoreDb(vorpal);
};
