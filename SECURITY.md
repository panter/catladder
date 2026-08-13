# Security Audit Report

A security audit report document is a comprehensive assessment of an application's security posture, containing security topics that auditors can mark to indicate the state of various security aspects.

It serves as a structured guide for security team to evaluate different security factors such as authentication, authorization, data encryption, input validation, and more.

## General Information

- Project Owner is @maw
- Dev team:
  - @maw
  - @leu
  - @lma
  - @vok
  - @sia
  - @koa
  - @brl

## Project Security


| Responsible | ✅/❌ | Description                                                                        | Note | More Information                                                                             |
| ----------- | --- | ---------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| @lma        | ✅ | No API keys or secrets are stored in repository                                    |      |                                                                                              |
| @lma        | ✅ | The app does not provide password login                                            |      |                                                                                              |
| @lma        | ✅ | Passwords are not stored                                                           |      |                                                                                              |
| @lma        | ✅ | Passwords are stored hashed with salt and salt is not stored in the repository     |      |           |
| @lma        | ✅ | Input that ends up in DOM is properly sanitized                                    | No DOM |            |
| @lma        | ❌ | All user inputs have reasonable validations                                        |      |     |
| @lma        | ✅ | The app is not using cookies                                                       |      |        |
| @lma        | ✅ | The app is using cookies and cookies are properly configured                       |      |        |
| @lma        | ✅ | The app uses JWT with a secret and the secret is not stored in the repository      | No auth |        |
| @lma, @lma  | ✅ | Authorization and user roles (RBAC) were reviewed thoroughly                       | No auth |  |
| @lma        | ✅ | CORS headers do not use `*`                                                        |      |           |
| @lma        | ✅ | CSP headers are properly configured (no `unsafe-inline` or `unsafe-eval`)          |      |            |
| @lma        | ❌ | DoS defense mechanism is implemented                                               |      |            |
| @lma        | ❌ | YAML/XML parsing is not used or used YAML/XML parsers have disabled DTD            |      |            |
| @lma        | ✅ | The app implements CSRF prevention                                                 | No server |           |
| @lma        | ❌ | The app has a rate limitter                                                        |      |                                                                                              |
| @lma        | ✅ | The app has disabled GraphQL introspection and schema registry                     | No GraphQL |        |
| @lma        | ✅ | The app has set GraphQL complexity query limits                                    | No GraphQL |        |
| @lma        | ✅ | `sitemap.xml` does not leak any routes with sensitive data                         | No sitemap |                                                                                              |
| @lma        | ✅ | Cloud storage is (private) configured to not leak any sensitive data publicly      | No cloud storage |                                                                                              |
| @lma        | ❌ | Security Dashboard checks weekly vulnerable dependencies https://dep.panter.swiss/ |      |                                                                                              |
| @lma        | ❌ | The app has `.well-known/security.txt` https://securitytxt.org/                    | No server |                                                                                              |


