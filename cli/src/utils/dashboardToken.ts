import { exec } from "child-process-promise";
import clipboardy from "clipboardy";
export const getToken = async () => {
  const { stdout } = await exec(
    `kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | awk '/^deployment-controller-token-/{print $1}') | awk '$1=="token:"{print $2}'`
  );
  return stdout;
};

export async function printToken() {
  await this.log(
    "you will need to pass a token to the dashboard. We will copy it to your clipboard!"
  );
  const token = await getToken();
  await this.log("");
  await this.log(token);
  await this.log("");
  await clipboardy.write(token);
  await this.log("");
}
