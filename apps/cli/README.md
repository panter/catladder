# catladder CLI

[Panter](https://panter.ch) CLI tool for cloud CI/CD and DevOps.

## Getting started

[See the documentation][docs-getting-started].

[docs-getting-started]: https://panter.github.io/catladder/docs/getting_started "Getting started"

## Usage

```bash
catladder <command> [options]
catladder --help
catladder <command> --help
```

### Shell completions

```bash
catladder completion install
```

### Non-interactive mode

```bash
catladder project port-forward dev:web --pod-name=web-abc --local-port=3000 --remote-port=3000
catladder -y project delete dev:web
```

## Contribution

[See contribution guide][docs-contribute].

[docs-contribute]: https://panter.github.io/catladder/docs/contribute "Contribution guide"
