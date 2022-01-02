import { getAllNamespacesNames } from "./index";
export const namespaceAutoCompletion = {
  async data() {
    const namespaces = await getAllNamespacesNames();
    return namespaces;
  }
};
