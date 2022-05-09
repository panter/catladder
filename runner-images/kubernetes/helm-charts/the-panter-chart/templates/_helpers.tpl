{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}


{{- define "appImage" -}}
  {{ .Values.image.repository }}/{{ .Values.image.name }}:{{ .Values.image.tag }}
{{- end -}}


{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "fullname" -}}
{{- default .Release.Name .Values.global.componentName | trunc 63 | trimSuffix "-" -}}
{{- end -}}



{{/*
create a prefix for variable names, this is useful in service discovery in review apps
*/}}
{{- define "serviceVarPrefix" -}}
{{ include "fullname" . | snakecase | upper }}
{{- end -}}


{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}


{{/*
get the right host
*/}}
{{- define "host" -}}
   {{- default .Values.application.hostCanonical .Values.application.host -}}
{{- end -}}

{{- define "MAILHOG_SMTP_URL" -}}
{{- $namespace := .Release.Namespace -}}
{{- printf "smtp://%s.%s.svc.cluster.local:1025" .Values.mailhog.fullnameOverride $namespace -}}
{{- end -}}

{{- define "DB_NAME" -}}
{{ template "fullname" . }}
{{- end -}}

{{- define "POSTGRESQL_URL" -}}
postgresql://postgres:$(POSTGRESQL_PASSWORD)@localhost/{{ template "DB_NAME" . }}?schema=public
{{- end -}}

{{- define "POSTGRESQL_HOST" -}}
localhost
{{- end -}}

{{- define "DB_USERNAME" -}}
postgres
{{- end -}}


{{- define "DB_PASSWORD" -}}
$(POSTGRESQL_PASSWORD)
{{- end -}}

{{/*
Generate mongodb-URL
*/}}
{{- define "MONGO_URL" -}}
{{- $numberOfRecplias := int (index .Values "mongodb-replicaset" "replicas") -}}
{{- $appName := default .Release.Name .Values.global.componentName -}}
{{- $namespace := .Release.Namespace -}}
mongodb://
{{- range $i, $e := until $numberOfRecplias -}}
{{- /* https://stackoverflow.com/a/21305933 */ -}}
{{- if $i -}},{{- end -}}
{{- printf "%s-mongodb-replicaset-%d.%s-mongodb-replicaset.%s.svc.cluster.local:27017" $appName $i $appName $namespace -}}
{{- end -}}
{{- printf "/%s?replicaSet=rs0" .Values.mongodb.dbName -}}
{{- end -}}
# TODO: deduplicate code
{{- define "MONGO_OPLOG_URL" -}}
{{- $numberOfRecplias := int (index .Values "mongodb-replicaset" "replicas") -}}
{{- $appName := default .Release.Name .Values.global.componentName -}}
{{- $namespace := .Release.Namespace -}}
mongodb://
{{- range $i, $e := until $numberOfRecplias -}}
{{- /* https://stackoverflow.com/a/21305933 */ -}}
{{- if $i -}},{{- end -}}
{{- printf "%s-mongodb-replicaset-%d.%s-mongodb-replicaset.%s.svc.cluster.local:27017" $appName $i $appName $namespace -}}
{{- end -}}
{{- printf "/%s?replicaSet=rs0" "local" -}}
{{- end -}}


{{- define "cloudSqlContainer" -}}
name: cloudsql-proxy
image: eu.gcr.io/cloudsql-docker/gce-proxy:1.27.0-alpine
# see https://github.com/kubernetes/kubernetes/issues/25908#issuecomment-308569672
command: ["/bin/sh", "-c"]
args:
  - |
    /cloud_sql_proxy -instances={{ .Values.cloudsql.projectId}}:{{ .Values.cloudsql.region}}:{{ default .Release.Namespace .Values.cloudsql.instanceId }}=tcp:5432 -credential_file=/secrets/cloudsql/credentials.json &
    CHILD_PID=$!
    (while true; do if [[ -f "/tmp/pod/main-terminated" ]]; then kill $CHILD_PID; fi; sleep 1; done) &
    wait $CHILD_PID
    if [[ -f "/tmp/pod/main-terminated" ]]; then exit 0; fi
securityContext:
  runAsUser: 2  # non-root user
  allowPrivilegeEscalation: false
resources: # each container needs requests, or the auto load balancer does not work
  requests:
    cpu: 50m
    memory: 150Mi
volumeMounts:
  - name: cloudsql-proxy-credentials
    mountPath: /secrets/cloudsql
    readOnly: true
    
  - mountPath: /tmp/pod
    name: tmp-pod
    readOnly: true
{{- end -}}

{{- define "cloudSqlCredentialsVolume" -}}
name: cloudsql-proxy-credentials
secret:
  secretName: {{ template "fullname" $ }}-cloudsql-proxy-credentials
{{- end -}}
{{/*
Generate prisma-URL
*/}}
{{- define "PRISMA_ENDPOINT" -}}
  {{- $appName := default .Release.Name .Values.global.componentName -}}
  {{- $namespace := .Release.Namespace -}}
  {{- printf "http://%s-prisma.%s:4466/default/default" $appName $namespace -}}
{{- end -}}




{{/*
convert value to json-string if its an object
*/}}
{{- define "envValue" -}}
  {{- if (kindIs "map" .) -}}
    {{ toJson . | quote}}
  {{- else -}}
    {{ quote . }}
  {{- end -}}
{{- end -}}


{{- define "env" -}}
{{ $context := . }}

envFrom:
  - configMapRef:
      name: {{ template "fullname" $ }}-app-env
env: 
  {{- range $key, $val := .Values.env.secret }}
  - name: {{ $key }}
    valueFrom:
      secretKeyRef:
        name: {{ template "fullname" $ }}-app-secrets
        key: {{ $key }}
  {{- end }}

  # can't have these in app.env.configmap as some values contain  $(OTHER_ENV_VAR)
  {{ if .Values.cloudsql.enabled }}
  - name: POSTGRESQL_URL
    value: "{{- template "POSTGRESQL_URL" . -}}"
  - name: DATABASE_URL
    value: "{{- template "POSTGRESQL_URL" . -}}"
  
  - name: POSTGRESQL_HOST
    value: "{{- template "POSTGRESQL_HOST" . -}}"
  - name: DB_HOST # alias
    value: "{{- template "POSTGRESQL_HOST" . -}}"
  - name: DB_NAME 
    value: "{{- template "DB_NAME" . -}}"
  - name: DB_USERNAME #alias
    value: "{{- template "DB_USERNAME" . -}}"
  - name: DB_PASSWORD #alias
    value: "{{- template "DB_PASSWORD" . -}}"
  - name: POSTGRESQL_DBNAME # alias
    value: "{{- template "DB_NAME" . -}}"
  {{- end -}}
  {{- range $index, $varName := .Values.secretsAsFile }}  # expose mounted secrets as variable that contain the path of the secret
  - name: "{{$varName}}"
    value: "/secrets/{{ $varName }}"
  {{- end -}}
{{- end -}}



{{- define "visualReviewSnippet" -}}
  <script
    data-project-id='{{.Values.gitlab.projectId}}'
    data-merge-request-id='{{.Values.gitlab.mergeRequestId}}'
    data-mr-url='https://git.panter.ch'
    data-project-path='{{.Values.gitlab.projectPath}}'
    id='review-app-toolbar-script'
    src='https://git.panter.ch/assets/webpack/visual_review_toolbar.js'>
  </script>
{{- end -}}
