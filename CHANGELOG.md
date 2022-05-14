# [1.27.0](https://git.panter.ch/catladder/catladder/compare/v1.26.0...v1.27.0) (2022-05-14)


### Features

* support node 18 by using node 16 as base for pipeline ([ddfae61](https://git.panter.ch/catladder/catladder/commit/ddfae617fe1a62dccb87430291e42c38132a924a))

# [1.26.0](https://git.panter.ch/catladder/catladder/compare/v1.25.0...v1.26.0) (2022-05-13)


### Features

* respect nvmrc file in the root directory ([ddc1703](https://git.panter.ch/catladder/catladder/commit/ddc17037fbe42a6babefbfef23a45baec4ab0d31))

# [1.25.0](https://git.panter.ch/catladder/catladder/compare/v1.24.2...v1.25.0) (2022-05-09)


### Features

* **kubernetes:** add mongodb oplog url variable ([9e5cd12](https://git.panter.ch/catladder/catladder/commit/9e5cd129b2e88f90b93d7d21fcfd3c055a72b181))

## [1.24.2](https://git.panter.ch/catladder/catladder/compare/v1.24.1...v1.24.2) (2022-05-04)


### Bug Fixes

* typeerror again ([a41aa60](https://git.panter.ch/catladder/catladder/commit/a41aa606734cc76edc8c10643af14fd25eeb1c5c))

## [1.24.1](https://git.panter.ch/catladder/catladder/compare/v1.24.0...v1.24.1) (2022-05-04)


### Bug Fixes

* wrong type ([34c16b5](https://git.panter.ch/catladder/catladder/commit/34c16b590f28a0f7a49762c588f810d23c9d99b2))

# [1.24.0](https://git.panter.ch/catladder/catladder/compare/v1.23.0...v1.24.0) (2022-04-29)


### Features

* **autoscale:** extend type to include AverageValue ([0829a69](https://git.panter.ch/catladder/catladder/commit/0829a69c9123b19324f07e5eb963b876facbde0f))

# [1.23.0](https://git.panter.ch/catladder/catladder/compare/v1.22.1...v1.23.0) (2022-04-26)


### Features

* **kubernetes:** horizontal pod autoscaler ([b4ee7de](https://git.panter.ch/catladder/catladder/commit/b4ee7de90c76bda1459cd2737aed8635c3d1c927))

## [1.22.1](https://git.panter.ch/catladder/catladder/compare/v1.22.0...v1.22.1) (2022-04-25)


### Bug Fixes

* **storybook:** storybook build logs verbosly ([dcf173a](https://git.panter.ch/catladder/catladder/commit/dcf173a6a9bfc88f7ec59496d11b4acbe40b2383))

# [1.22.0](https://git.panter.ch/catladder/catladder/compare/v1.21.1...v1.22.0) (2022-04-22)


### Features

* custom deploy job ([f7d582a](https://git.panter.ch/catladder/catladder/commit/f7d582a5fd66863dbd17d10ab96d45f4f76fc4bf))

## [1.21.1](https://git.panter.ch/catladder/catladder/compare/v1.21.0...v1.21.1) (2022-04-20)


### Bug Fixes

* use merge request id as deployment identifier to support long branches ([533a269](https://git.panter.ch/catladder/catladder/commit/533a26980775418b7f9705f95c98b1548b649c9e))

# [1.21.0](https://git.panter.ch/catladder/catladder/compare/v1.20.3...v1.21.0) (2022-04-20)


### Features

* custom job definition for arbitrary jobs ([20c2372](https://git.panter.ch/catladder/catladder/commit/20c2372b4bcf55e6ff77b893d0ddc12b309a827a))

## [1.20.3](https://git.panter.ch/catladder/catladder/compare/v1.20.2...v1.20.3) (2022-04-14)


### Bug Fixes

* don't block the pipeline on manual deploy jobs ([bdd1f21](https://git.panter.ch/catladder/catladder/commit/bdd1f21f8eda8f6ef3d0117fc4f702daa0481cce))

## [1.20.2](https://git.panter.ch/catladder/catladder/compare/v1.20.1...v1.20.2) (2022-04-14)


### Bug Fixes

* reduce the requests for job cpu defaults ([2039378](https://git.panter.ch/catladder/catladder/commit/20393784c76de089f7f42f2fdff6e9e9632e0d5e))

## [1.20.1](https://git.panter.ch/catladder/catladder/compare/v1.20.0...v1.20.1) (2022-04-12)


### Bug Fixes

* accidential log ([211203a](https://git.panter.ch/catladder/catladder/commit/211203a0f93bc6e8056fc7f68f1697e8f0adaca0))

# [1.20.0](https://git.panter.ch/catladder/catladder/compare/v1.19.1...v1.20.0) (2022-04-12)


### Bug Fixes

* endless loop in resolve references ([7e63586](https://git.panter.ch/catladder/catladder/commit/7e63586a0e47a2bbc505e516efb7e288a5e518c8))


### Features

* allow to force manual/auto deploy per env ([45fcace](https://git.panter.ch/catladder/catladder/commit/45fcace89e85ea74d483f000eb22225fe949d036))

## [1.19.1](https://git.panter.ch/catladder/catladder/compare/v1.19.0...v1.19.1) (2022-04-08)


### Bug Fixes

* catenv hangs ([5866927](https://git.panter.ch/catladder/catladder/commit/5866927de30ffd34221225a122e62f4b407ff943))

# [1.19.0](https://git.panter.ch/catladder/catladder/compare/v1.18.1...v1.19.0) (2022-04-06)


### Bug Fixes

* values.secretsAsFile not working properly ([73f39da](https://git.panter.ch/catladder/catladder/commit/73f39da533a5cc312a74e052619688ccb9bf4652))


### Features

* **cli:** watch config for changes ([80737ac](https://git.panter.ch/catladder/catladder/commit/80737acd517e779ad2176dd161636bd7708cbaaf))

## [1.18.1](https://git.panter.ch/catladder/catladder/compare/v1.18.0...v1.18.1) (2022-04-06)


### Bug Fixes

* try-catch legacy bitwarden t ([9c67745](https://git.panter.ch/catladder/catladder/commit/9c67745ea385309ccb91f37b722be49c52723c0e))

# [1.18.0](https://git.panter.ch/catladder/catladder/compare/v1.17.2...v1.18.0) (2022-04-06)


### Features

* allow to mount secrets as files ([b8b8f30](https://git.panter.ch/catladder/catladder/commit/b8b8f30d1d341c75deae14dae6c428ff4e5200ea))

## [1.17.2](https://git.panter.ch/catladder/catladder/compare/v1.17.1...v1.17.2) (2022-04-04)


### Bug Fixes

* **cli:** cloud sql proxy should not use bitwarden anymore ([c8fa517](https://git.panter.ch/catladder/catladder/commit/c8fa517e83c1948873ac4908baa6cc580e983610))

## [1.17.1](https://git.panter.ch/catladder/catladder/compare/v1.17.0...v1.17.1) (2022-04-01)


### Bug Fixes

* ENV_SHORT missing in local dev ([4a62fdf](https://git.panter.ch/catladder/catladder/commit/4a62fdfb4c47508bee042064d1e1ca0eb9732fcf))

# [1.17.0](https://git.panter.ch/catladder/catladder/compare/v1.16.3...v1.17.0) (2022-04-01)


### Bug Fixes

* setup GL_TOKEN ([5a06e87](https://git.panter.ch/catladder/catladder/commit/5a06e87ad9febf0e0063368d96e480cfef01e3b3))


### Features

* improved variable handling ([07a720d](https://git.panter.ch/catladder/catladder/commit/07a720d07b5d63308739aae20f20400d141b4d7e))

## [1.16.3](https://git.panter.ch/catladder/catladder/compare/v1.16.2...v1.16.3) (2022-03-30)


### Bug Fixes

* **cli:** switch clusters does not work ([632e3d3](https://git.panter.ch/catladder/catladder/commit/632e3d3514731ba22275415a06282481baa47c7e))

## [1.16.2](https://git.panter.ch/catladder/catladder/compare/v1.16.1...v1.16.2) (2022-03-28)


### Bug Fixes

* exit shell scripts immediately if error occurs ([ae9c708](https://git.panter.ch/catladder/catladder/commit/ae9c708f104fe28658500c028a67c28847b895ff))

## [1.16.1](https://git.panter.ch/catladder/catladder/compare/v1.16.0...v1.16.1) (2022-03-21)


### Bug Fixes

* type error ([c0f1318](https://git.panter.ch/catladder/catladder/commit/c0f1318db79c0627af9b48f394f2d58d8d199826))

# [1.16.0](https://git.panter.ch/catladder/catladder/compare/v1.15.1...v1.16.0) (2022-03-16)


### Features

* support yarn audit for yarn 2 ([fc41465](https://git.panter.ch/catladder/catladder/commit/fc41465c93695ce81b0742aefd0e358187aa3d29))

## [1.15.1](https://git.panter.ch/catladder/catladder/compare/v1.15.0...v1.15.1) (2022-03-16)

# [1.15.0](https://git.panter.ch/catladder/catladder/compare/v1.14.0...v1.15.0) (2022-03-15)


### Features

* **cli:** improve ux for setup ([53adcbb](https://git.panter.ch/catladder/catladder/commit/53adcbba69e47b201a0c646482fec89988e2a94e))

# [1.14.0](https://git.panter.ch/catladder/catladder/compare/v1.13.0...v1.14.0) (2022-03-15)


### Features

* **cli:** improve project setup, the command is now named `projec-setup` ([289fd30](https://git.panter.ch/catladder/catladder/commit/289fd303b0fb7d2135986dc2de6cca9a69294e40))

# [1.13.0](https://git.panter.ch/catladder/catladder/compare/v1.12.0...v1.13.0) (2022-03-15)


### Bug Fixes

* higher limit for cpu ([7a0c02c](https://git.panter.ch/catladder/catladder/commit/7a0c02cdfd8eb6efafb586e6f6c6912a4a24e6ec))


### Features

* yaml for gitlab pipeline instead of js ([64b628f](https://git.panter.ch/catladder/catladder/commit/64b628f854b772844e22b56471281b67436161a6))

# [1.12.0](https://git.panter.ch/catladder/catladder/compare/v1.11.0...v1.12.0) (2022-03-15)


### Bug Fixes

* **cli:** migration does not work properly when component name is not defined ([390edd9](https://git.panter.ch/catladder/catladder/commit/390edd9dd6ff33995477c7ed067e54bcf00e4bde))


### Features

* artifactsPaths ([111ada3](https://git.panter.ch/catladder/catladder/commit/111ada30ed95ee282f1b8c9afb58e4cad9def5fb))
* **cli:** give hint that value yaml files are no longer needed ([ffca782](https://git.panter.ch/catladder/catladder/commit/ffca782816b62db3f25b302232dc2ac818ad87b2))
* improved yarn workspaces support ([c92fbc8](https://git.panter.ch/catladder/catladder/commit/c92fbc83f28ca799391cb32dcd4c5d69647c8ae5))

# [1.11.0](https://git.panter.ch/catladder/catladder/compare/v1.10.2...v1.11.0) (2022-03-07)


### Bug Fixes

* increase defaults once more ([5b031be](https://git.panter.ch/catladder/catladder/commit/5b031be5711fcb547d3a945fe9e0abb311a69784))
* yarninfo not working correctly in yarn 2 ([bae3747](https://git.panter.ch/catladder/catladder/commit/bae37475da2bb3fe1720eb6c0b17fe878ad9f725))


### Features

* support yarnrc and npmrc files ([bdbef31](https://git.panter.ch/catladder/catladder/commit/bdbef31fe26d9c99f126f58ac13bc2bfc80cd056))

## [1.10.2](https://git.panter.ch/catladder/catladder/compare/v1.10.1...v1.10.2) (2022-03-02)


### Bug Fixes

* node build job variables overrides extraVars ([9012168](https://git.panter.ch/catladder/catladder/commit/90121680f3e04dc8476d9580abee1d468fbf3fb5))

## [1.10.1](https://git.panter.ch/catladder/catladder/compare/v1.10.0...v1.10.1) (2022-03-02)


### Bug Fixes

* **kubernetes:** deploy crash if hostname contains a dot precicily at 59 position ([3d69f32](https://git.panter.ch/catladder/catladder/commit/3d69f32cc3de37833ee910d2cbbd6e031ca768d7))

# [1.10.0](https://git.panter.ch/catladder/catladder/compare/v1.9.1...v1.10.0) (2022-02-23)


### Features

* make it easier to cusstomize health route ([63a8742](https://git.panter.ch/catladder/catladder/commit/63a87423f7b2dc4007336cd6f6843d30728b9420))

## [1.9.1](https://git.panter.ch/catladder/catladder/compare/v1.9.0...v1.9.1) (2022-02-23)


### Bug Fixes

* increaes default memory requests for build jobs ([65d2082](https://git.panter.ch/catladder/catladder/commit/65d2082d38e20c252f48af1a874f74f222f2fcbd))

# [1.9.0](https://git.panter.ch/catladder/catladder/compare/v1.8.0...v1.9.0) (2022-02-21)


### Features

* readd full gitlab init stuff ([9715c26](https://git.panter.ch/catladder/catladder/commit/9715c26251e2b82f406773b0dc733521ceaf0d8f))

# [1.8.0](https://git.panter.ch/catladder/catladder/compare/v1.7.0...v1.8.0) (2022-02-21)


### Features

* **cli cloudsql:** show postgres connection string for convencience ([e5908da](https://git.panter.ch/catladder/catladder/commit/e5908daa737c1906b92c4dfa2c9be2fa6573cb87))

# [1.7.0](https://git.panter.ch/catladder/catladder/compare/v1.6.0...v1.7.0) (2022-02-16)


### Features

* **cli:** enable to config secrets over all components and envs ([bd68540](https://git.panter.ch/catladder/catladder/commit/bd685403041176d548aa93781cb1836e13696a86))

# [1.6.0](https://git.panter.ch/catladder/catladder/compare/v1.5.8...v1.6.0) (2022-02-16)


### Features

* add ENV_TYPE as predefined env var ([32d07a3](https://git.panter.ch/catladder/catladder/commit/32d07a3908f77cbe1821a29cde8e589ae3c9d407))

## [1.5.8](https://git.panter.ch/catladder/catladder/compare/v1.5.7...v1.5.8) (2022-02-16)


### Bug Fixes

* **mongodb:** default to "standard" storage as "fast" is not available on the new cluster ([ef6328c](https://git.panter.ch/catladder/catladder/commit/ef6328c42139fd4cab10df4c416cc78881158642))

## [1.5.7](https://git.panter.ch/catladder/catladder/compare/v1.5.6...v1.5.7) (2022-02-16)


### Bug Fixes

* **kubernetes:** can't manage statfulsets (required for mongodb) ([13e5bc5](https://git.panter.ch/catladder/catladder/commit/13e5bc50c483ad13ad692d9237dfb9176d2b5aa1))

## [1.5.6](https://git.panter.ch/catladder/catladder/compare/v1.5.5...v1.5.6) (2022-02-11)


### Bug Fixes

* **cli:** migrate string command ([508a469](https://git.panter.ch/catladder/catladder/commit/508a469f4824ab2437fb7b6f7b80954a4cb83fea))

## [1.5.5](https://git.panter.ch/catladder/catladder/compare/v1.5.4...v1.5.5) (2022-02-11)


### Bug Fixes

* **cli:** run yarn non-interactively to avoid hanging due to a prompt ([bd5ec09](https://git.panter.ch/catladder/catladder/commit/bd5ec090b80e1dd7fbf9568cf0928808f3b25557))
* **cli:** upgrade js-yaml so undefined is not serialized to yaml ([0bec73d](https://git.panter.ch/catladder/catladder/commit/0bec73de0d1ffb7d007bb46146d83bcb9b7729cb))

## [1.5.4](https://git.panter.ch/catladder/catladder/compare/v1.5.3...v1.5.4) (2022-02-11)


### Bug Fixes

* **cli:** git stage the right file when choosing yaml config ([e5749c2](https://git.panter.ch/catladder/catladder/commit/e5749c2c52ff27d763d4c0335030a578359f1c43))

## [1.5.3](https://git.panter.ch/catladder/catladder/compare/v1.5.2...v1.5.3) (2022-02-10)

## [1.5.2](https://git.panter.ch/catladder/catladder/compare/v1.5.1...v1.5.2) (2022-02-10)


### Bug Fixes

* **cli:** open dashboard broken link ([6e645d7](https://git.panter.ch/catladder/catladder/commit/6e645d70eaaf958b0edde37e21212dac6f0580c7))

## [1.5.1](https://git.panter.ch/catladder/catladder/compare/v1.5.0...v1.5.1) (2022-02-10)


### Bug Fixes

* **storybook:** wrong default build command ([3893c69](https://git.panter.ch/catladder/catladder/commit/3893c69df6e2f40a6e3b22a395b45cf21dd43fd1))

# [1.5.0](https://git.panter.ch/catladder/catladder/compare/v1.4.5...v1.5.0) (2022-02-09)


### Features

* migration improvements ([fd71509](https://git.panter.ch/catladder/catladder/commit/fd7150999e5c7bf0493e7112c9d95002c923ad54))

## [1.4.5](https://git.panter.ch/catladder/catladder/compare/v1.4.4...v1.4.5) (2022-02-09)


### Bug Fixes

* small fixes ([e236024](https://git.panter.ch/catladder/catladder/commit/e236024db1b273a168b33380186c21896b2a95cb))

## [1.4.4](https://git.panter.ch/catladder/catladder/compare/v1.4.3...v1.4.4) (2022-02-08)


### Bug Fixes

* using host instead of hostname ([d606e3c](https://git.panter.ch/catladder/catladder/commit/d606e3c97ce4d9c178b3a8b7d50e0bb51c46fc81))

## [1.4.3](https://git.panter.ch/catladder/catladder/compare/v1.4.2...v1.4.3) (2022-02-08)


### Bug Fixes

* custom host not wokring ([e5f17f8](https://git.panter.ch/catladder/catladder/commit/e5f17f8d565b000f8273add2e9448e2b5dd75ceb))

## [1.4.2](https://git.panter.ch/catladder/catladder/compare/v1.4.1...v1.4.2) (2022-02-08)


### Bug Fixes

* redirects not working ([9c0053b](https://git.panter.ch/catladder/catladder/commit/9c0053bb17e666eb54ca43d7c3b7680f2493b560))

## [1.4.1](https://git.panter.ch/catladder/catladder/compare/v1.4.0...v1.4.1) (2022-02-08)


### Bug Fixes

* secrets not merged properly ([6ed13de](https://git.panter.ch/catladder/catladder/commit/6ed13de0ea38b56ad1161d0df1087d2e9cddc53e))

# [1.4.0](https://git.panter.ch/catladder/catladder/compare/v1.3.2...v1.4.0) (2022-02-08)


### Bug Fixes

* typo ([f2cfa63](https://git.panter.ch/catladder/catladder/commit/f2cfa631f9b43dddded89fcddf31466e26718089))


### Features

* auto deploy when stage is enabled ([8a02ba3](https://git.panter.ch/catladder/catladder/commit/8a02ba3b7031df7e62160a29049e7d8abcf90861))

## [1.3.2](https://git.panter.ch/catladder/catladder/compare/v1.3.1...v1.3.2) (2022-02-08)


### Bug Fixes

* crash when env var is number and not string ([7f26488](https://git.panter.ch/catladder/catladder/commit/7f26488ea8b195f1b3798698f0350e5cde5d16e2))

## [1.3.1](https://git.panter.ch/catladder/catladder/compare/v1.3.0...v1.3.1) (2022-02-08)


### Bug Fixes

* stop environment not working ([05b6684](https://git.panter.ch/catladder/catladder/commit/05b668481033d270ca6a2e1c34cf844499dc2e6b))

# [1.3.0](https://git.panter.ch/catladder/catladder/compare/v1.2.0...v1.3.0) (2022-02-08)


### Features

* tag namespaces properly ([1a136b6](https://git.panter.ch/catladder/catladder/commit/1a136b6bcaca8dce1cea67f9a63b065cd321ba19))

# [1.2.0](https://git.panter.ch/catladder/catladder/compare/v1.1.2...v1.2.0) (2022-02-08)


### Bug Fixes

* remove non existing pantobot api ([cb1bc1d](https://git.panter.ch/catladder/catladder/commit/cb1bc1d979f1e96bb353776b285ede0cdbbc22e0))


### Features

* debug helm deploy ([3548765](https://git.panter.ch/catladder/catladder/commit/354876553d2e6ef42c4efe8c1155dd44b40458c4))
* FF_USE_FASTZIP ([097f47f](https://git.panter.ch/catladder/catladder/commit/097f47fbf5e4fa5a591ba9f33b46c99a06728e10))
* new canonical domain handling ([7af0546](https://git.panter.ch/catladder/catladder/commit/7af05465dd8079d62f1d6d14cbcecf198de91123))
* new cluster management ([1ee4332](https://git.panter.ch/catladder/catladder/commit/1ee4332aeafaa4463269d8c8e1d0796ed9bf16ab))
* new multi kube support ([9e149f5](https://git.panter.ch/catladder/catladder/commit/9e149f546237500189251551ad01bb4e162edea5))
* review apps have now different name ([3175f5e](https://git.panter.ch/catladder/catladder/commit/3175f5e02280b92400fbc813923b29709465359c))
* use build kit for docker build ([d6ed7ea](https://git.panter.ch/catladder/catladder/commit/d6ed7ead2b4731b9ac0a36eb495be9fc456cf03f))

## [1.1.2](https://git.panter.ch/catladder/catladder/compare/v1.1.1...v1.1.2) (2022-02-04)

## [1.1.1](https://git.panter.ch/catladder/catladder/compare/v1.1.0...v1.1.1) (2022-02-04)


### Bug Fixes

* NODE_RUNNER_BUILD_VARIABLES not applied to build job, only to non-build node jobs ([70129b1](https://git.panter.ch/catladder/catladder/commit/70129b104ea1eee38ab5237cd8710c2dd2eb5a11))

# [1.1.0](https://git.panter.ch/catladder/catladder/compare/v1.0.5...v1.1.0) (2022-02-04)


### Features

* increase memory limit for node ([d7efe3c](https://git.panter.ch/catladder/catladder/commit/d7efe3cb3c12985273d58784de2a0472f1e66de6))

## [1.0.5](https://git.panter.ch/catladder/catladder/compare/v1.0.4...v1.0.5) (2022-02-03)

## [1.0.4](https://git.panter.ch/catladder/catladder/compare/v1.0.3...v1.0.4) (2022-02-03)


### Bug Fixes

* docker image tagging is wrong ([26283f4](https://git.panter.ch/catladder/catladder/commit/26283f46eadf072bd21f35c3916b8af949f4917d))

## [1.0.3](https://git.panter.ch/catladder/catladder/compare/v1.0.2...v1.0.3) (2022-02-01)


### Bug Fixes

* accidental global this ([5ff1b14](https://git.panter.ch/catladder/catladder/commit/5ff1b14d060882a31a6ef74bb05a445a93232097))

## [1.0.2](https://git.panter.ch/catladder/catladder/compare/v1.0.1...v1.0.2) (2022-02-01)

## [1.0.1](https://git.panter.ch/catladder/catladder/compare/v1.0.0...v1.0.1) (2022-02-01)


### Bug Fixes

* migration fails when APP_DIR is not set ([eb4b8c5](https://git.panter.ch/catladder/catladder/commit/eb4b8c5ecf285bcae77d46485ce0a588e9721d3c))

# 1.0.0 (2022-01-28)


### Bug Fixes

* accidential spread ([a600097](https://git.panter.ch/catladder/catladder/commit/a6000978d14cb01c6dc824815ed87bdca7600656))
* audit not using cache ([ac61910](https://git.panter.ch/catladder/catladder/commit/ac61910808a3d361499444c369cd743feeb7f6e7))
* bug ([d74691d](https://git.panter.ch/catladder/catladder/commit/d74691dd0d3616ebaf4ed628e703593ab96a2a8e))
* bugs ([f350403](https://git.panter.ch/catladder/catladder/commit/f350403c1167b37ea23f548f5677a57fb2ecedb6))
* catenv ([e3dd7f0](https://git.panter.ch/catladder/catladder/commit/e3dd7f09eb96ed6909f50a4d2981218569932874))
* config secrets broken if componentName contains dash ([239cb0b](https://git.panter.ch/catladder/catladder/commit/239cb0b8e0bfc2b9824aafd586eb1443d0f0f1a6))
* don't run pipeline after relese ([0631306](https://git.panter.ch/catladder/catladder/commit/06313065118023a0ddf95fe40538f0c53e215e8d))
* force quotes ([9489f68](https://git.panter.ch/catladder/catladder/commit/9489f68e7bbcbae92d6b25863d7524c678e33f42))
* **hopefully:** quotes in secrets ([02cd837](https://git.panter.ch/catladder/catladder/commit/02cd837fd13a49b145cc4d303222f081835f3aea))
* improve cache ([6daa948](https://git.panter.ch/catladder/catladder/commit/6daa94865d4981126590d228e29e5d176d8edc38))
* ingress not using custom hostname ([30343da](https://git.panter.ch/catladder/catladder/commit/30343da445193ff7c291d1732ccb7802dfa62de7))
* make env config partial ([825347d](https://git.panter.ch/catladder/catladder/commit/825347d87b2e4a7006df248ae19122aea7aca3bc))
* migrate secrets in monorepo ([82f6443](https://git.panter.ch/catladder/catladder/commit/82f644373bc022b187882d5790de09e8202df984))
* missing type ([b29ca0c](https://git.panter.ch/catladder/catladder/commit/b29ca0c2ea90abd9f8874023f21c8fd78d5a147b))
* prod deployed automatically instead of manually ([b880599](https://git.panter.ch/catladder/catladder/commit/b88059934db445b5ebf879b11a0f3e52ebb9cd51))
* redirects is not optional ([ecbbbfb](https://git.panter.ch/catladder/catladder/commit/ecbbbfbf97b65a4f43aec7cd6e99ec6c770fc856))
* release name ([777f12d](https://git.panter.ch/catladder/catladder/commit/777f12dab9668232c6051ff2f3f8ac20643e68bc))
* remove log ([74e213c](https://git.panter.ch/catladder/catladder/commit/74e213c52344e2c677680c2e65fc53b37eaa93f8))
* remove unused var ([5f838bc](https://git.panter.ch/catladder/catladder/commit/5f838bc293cf527a675fe3b571ae890a272c2309))
* switch yaml with js-yaml everywhere ([5fa889b](https://git.panter.ch/catladder/catladder/commit/5fa889b37127f58f2ca5698c18deaf617f2eae1c))
* type ([f8243b1](https://git.panter.ch/catladder/catladder/commit/f8243b15c1014ba72f4089571713d6d68692413b))
* type error ([d52f70c](https://git.panter.ch/catladder/catladder/commit/d52f70ca6e49ed846d5dc351515fe88bb663f021))
* type error in meteor build config ([47dcb7b](https://git.panter.ch/catladder/catladder/commit/47dcb7bc4cf432aef2b0a29bea02dd2ed8a386d3))
* typo ([4f942dc](https://git.panter.ch/catladder/catladder/commit/4f942dcd5dede514cc6dd2bd8df55d1c66ed1c52))


### Features

* add meteor build ([2664ec4](https://git.panter.ch/catladder/catladder/commit/2664ec45d4bd206e0c31b46357dfef4e23ae4d58))
* allow to disable lint, test and audit ([cbb5ba4](https://git.panter.ch/catladder/catladder/commit/cbb5ba4bee18c3f684c9d977740d018a51b87415))
* basic migration ([19a00ae](https://git.panter.ch/catladder/catladder/commit/19a00aea6178eea6f50648151d946134c2c20cab))
* better canonical url ([57e22cf](https://git.panter.ch/catladder/catladder/commit/57e22cfd8e925d22ae1561743d9a73d89ba390cf))
* better explanation ([9778e44](https://git.panter.ch/catladder/catladder/commit/9778e4475ad16243e1665d14c9507d8b177c7a62))
* better job name ([4776e35](https://git.panter.ch/catladder/catladder/commit/4776e35aa40121aa24173aa992ea8bb4ee19a812))
* better resources and refactor ([88dd0c2](https://git.panter.ch/catladder/catladder/commit/88dd0c256abc475b69a654f9df9812f42ba9754b))
* build extra vars ([70bd51e](https://git.panter.ch/catladder/catladder/commit/70bd51e43b2b920ea3037b7f41c8e9bfaa211250))
* change structure of env in review apps ([060ae18](https://git.panter.ch/catladder/catladder/commit/060ae1825a546fe4370d6dd412f2d88739ad23c7))
* cli (still broken) and a lot of other improvements ([0f93cc6](https://git.panter.ch/catladder/catladder/commit/0f93cc69950e4c279ee4a5f1fb66446667fb5fd7))
* docker additions ([87a6529](https://git.panter.ch/catladder/catladder/commit/87a6529fd0ace0f5bc30564a4004c6de97da6fb7))
* don't run tests after release ([0413022](https://git.panter.ch/catladder/catladder/commit/04130226c32c16907d56c866d26a647d63c6696c))
* emojis ([93207af](https://git.panter.ch/catladder/catladder/commit/93207af87a859496e4dd234cdb757181e1fd95ed))
* first working base version ([99cf026](https://git.panter.ch/catladder/catladder/commit/99cf0260850d14343e15a74a0b6dafe9b8ff8f2c))
* implement local dev env ([e493181](https://git.panter.ch/catladder/catladder/commit/e49318115181381018a7221c641e27fb7a1ef055))
* migrate monorepo ([5bebb92](https://git.panter.ch/catladder/catladder/commit/5bebb92e535e20a77599a27a3ba79bb232e09828))
* migrate secrets ([1f7b11b](https://git.panter.ch/catladder/catladder/commit/1f7b11b7569539ff7a501ed7551978ee9d653f10))
* optimize yarn cache for workspaces and non-workspaces ([c44328d](https://git.panter.ch/catladder/catladder/commit/c44328d0bae7582a49144bc3056894e0f00a36b3))
* prevent infinit loop ([0d4bc87](https://git.panter.ch/catladder/catladder/commit/0d4bc87fc7b5968d569985fc957de81459a5d817))
* re-implement many cli commands ([98feb6a](https://git.panter.ch/catladder/catladder/commit/98feb6ab57c19e6aa3a9ea9b7e3ce3c2b7ad56ca))
* readd prototype for cloud sql proxy credentials ([afd8622](https://git.panter.ch/catladder/catladder/commit/afd8622a71b91ab9b64d59e0ba597253af4a22c9))
* reload config ([05a96e2](https://git.panter.ch/catladder/catladder/commit/05a96e200464d194f334095a86f148379089796f))
* semantic release ([8e0805f](https://git.panter.ch/catladder/catladder/commit/8e0805ff349ec4ba865797b4f8ef9df0cc40febb))
* show version number ([b6a92a6](https://git.panter.ch/catladder/catladder/commit/b6a92a6b7d4ce294033db91658478152866523cf))
* slight optimize yarn cache ([0ca2ae1](https://git.panter.ch/catladder/catladder/commit/0ca2ae1677a25edde253e2f558184a70c65744b6))
* trigger dev on tagged release ([05222b3](https://git.panter.ch/catladder/catladder/commit/05222b358b2301dcdc4e860df3f3bc824a1c0df2))
* try other yarn cache ([405bf8b](https://git.panter.ch/catladder/catladder/commit/405bf8b1cc111b300ee7ad3b03e8406dbdde0731))
* undo yarn cach change ([470c8b3](https://git.panter.ch/catladder/catladder/commit/470c8b3b63b807ee25d95697e2bb135c69061a09))
