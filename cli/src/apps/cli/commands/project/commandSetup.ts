import type Vorpal from "vorpal";
import { setupProject } from "./setup";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-setup",
      "Initializes all environments and creates requires resources, service accounts, etc.",
    )
    .action(async function () {
      await setupProject(this);
    });
