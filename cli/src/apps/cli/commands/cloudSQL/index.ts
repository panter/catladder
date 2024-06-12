import type Vorpal from "vorpal";

import commandRestoreDb from "./commandRestoreDb";

export default async (vorpal: Vorpal) => {
  commandRestoreDb(vorpal);
};
