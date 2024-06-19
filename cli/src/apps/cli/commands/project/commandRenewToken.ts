import type Vorpal from "vorpal";
import { setupAccessTokens } from "./setup/setupAccessTokens";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-renew-token",
      "Configures the project access token for semantic release.",
    )
    .action(async function () {
      await setupAccessTokens(this);
    });
