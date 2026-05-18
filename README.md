# Catladder

**A comprehensive CI/CD and DevOps workflow toolkit for modern cloud deployments**

Catladder is a TypeScript-based framework designed to streamline GitLab CI/CD pipeline automation and DevOps workflows. Built by Panter, it provides developers and DevOps teams with powerful tools to manage complex deployment pipelines, cloud infrastructure, and automated workflows.

📚 **[Documentation](https://catladder.git.panter.biz/catladder/docs/getting_started)** - Get started with catladder in your projects

## 🚀 What Catladder Does

Catladder simplifies and automates your CI/CD workflows by providing:

- **Pipeline Generation**: Automatically generate and manage GitLab CI/CD pipelines from configuration
- **Cloud Deployment**: Streamlined deployment workflows for various cloud platforms
- **DevOps Automation**: Tools to automate common DevOps tasks and workflows
- **Agent Integration**: AI-powered assistance through integrations like Claude for automated reviews and support
- **Kubernetes Support**: Built-in support for Kubernetes deployments and orchestration

## 📦 Project Structure

This monorepo contains several key components:

### CLI (`@catladder/cli`)

Command-line tools for interacting with catladder workflows:

- **`catladder`** - CLI to interact with environments, updating secrets and many more
- **`catenv`** - Generates pipelines and environment variables. Can be invoked by direnv to:
  - Always have pipeline files (.catladder-generated, need to be checked in)
  - Have .env files locally with shared secrets

### Pipeline (`@catladder/pipeline`)

Core TypeScript framework for:

- GitLab CI/CD pipeline configuration and generation
- Workflow definitions and automation
- Integration with cloud platforms and services

### Documentation (`docs/`)

Comprehensive documentation and guides for using catladder in your projects.

## 🛠 Key Features

- **GitLab Integration**: Native support for GitLab CI/CD with automated pipeline generation
- **Cloud Native**: Built for modern cloud deployments with Kubernetes support
- **TypeScript First**: Type-safe configuration and development experience
- **Agent Powered**: AI integration for automated assistance and reviews
- **Extensible**: Modular architecture allows for custom workflows and integrations

## 🤝 Contributing

This project is maintained by the Panter team. For issues and feature requests, please use our [issue tracker](https://git.panter.ch/catladder/catladder/issues).

## 📄 License

MIT License - see the individual package.json files for detailed license information.
