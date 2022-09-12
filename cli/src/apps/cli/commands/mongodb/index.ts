import type Vorpal from "vorpal";
import projectMongoDestroyMember from "./projectMongoDestroyMember";
import projectMongoGetShell from "./projectMongoGetShell";
import projectMongoPortForward from "./projectMongoPortForward";

export default async (vorpal: Vorpal) => {
  projectMongoGetShell(vorpal);
  projectMongoPortForward(vorpal);
  projectMongoDestroyMember(vorpal);
};
