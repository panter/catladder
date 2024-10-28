import type Vorpal from "vorpal";
import { setupProject } from "./setup";
import { allComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-setup [component]",
      "Initializes all environments and creates requires resources, service accounts, etc.",
    )
    .autocomplete(await allComponents())
    .action(async function ({ component }) {
      await setupProject(this, component);
    });
