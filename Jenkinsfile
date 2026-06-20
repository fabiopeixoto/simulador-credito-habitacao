pipeline {
  // No global agent — Docker build/deploy run directly on the host where the
  // Docker daemon is available. Only the Validate stage uses a Docker container,
  // and it does NOT need the host Docker socket.
  agent none

  triggers {
    githubPush()
    cron('H 3 * * 1') // Refresh semanal de spreads — segunda-feira ~3h UTC
  }

  parameters {
    booleanParam(name: 'APPLY_OVERRIDES', defaultValue: false,
      description: 'Correr o override pontual de seguros/spreads/LTV (scripts/apply-overrides.js) após o deploy.')
    booleanParam(name: 'OVERRIDES_DRY_RUN', defaultValue: true,
      description: 'Se marcado, só pré-visualiza (--dry-run) sem gravar. Desmarca para aplicar a sério.')
  }

  environment {
    // Apenas valores não-sensíveis aqui. As credenciais NÃO são bindadas
    // globalmente: ao usar `credentials(...)` no environment de topo, o Jenkins
    // injecta um `withEnv` com os valores secretos à volta de TODAS as stages,
    // o que dispara o aviso "insecure interpolation of sensitive variables".
    // Em vez disso, cada secret é bindada com `withCredentials` só onde é usada.
    DEPLOY_IMAGE = "simulador-credito-habitacao:${env.GIT_COMMIT ?: 'latest'}"
    PUBLIC_APP_URL = 'https://simulador-credito.tiagomartins.pt/'
  }

  stages {
    stage('Validate') {
      // Runs inside a clean Node.js container — no Docker socket needed.
      agent { docker { image 'node:20-slim' } }
      steps {
        // Validação sem `npm run`: só precisa de `node` + script (evita falhas de PATH/npm no Docker agent).
        sh 'sh scripts/lint.sh'
      }
    }

    stage('Actualizar Spreads') {
      // Só corre quando disparado pelo cron (não em cada push).
      // Chama o endpoint de refresh da app já em execução e aguarda até 3 min.
      when { triggeredBy 'TimerTrigger' }
      agent any
      steps {
        withCredentials([string(credentialsId: 'admin-token', variable: 'ADMIN_TOKEN')]) {
          sh '''
          APP_URL="http://localhost:3999"
          echo "A submeter actualização de spreads..."
          curl -sf -X POST "${APP_URL}/api/spreads" \
            -H "x-admin-token: ${ADMIN_TOKEN}" \
            --max-time 15 || echo "Refresh iniciado (resposta pode ter excedido timeout)"

          echo "A aguardar conclusão do refresh (máx 3 min)..."
          for i in $(seq 1 36); do
            sleep 5
            RUNNING=$(curl -sf "${APP_URL}/api/spreads" --max-time 5 \
              | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('running',''))" 2>/dev/null)
            [ "$RUNNING" = "False" ] || [ "$RUNNING" = "false" ] && break
          done

          echo "A aprovar spreads automaticamente..."
          curl -sf -X POST "${APP_URL}/api/spreads" \
            -H "x-admin-token: ${ADMIN_TOKEN}" \
            -H "x-spreads-action: approve" \
            --max-time 10 || echo "Aprovação falhou (pode não haver dados pendentes)"
          '''
        }
      }
    }

    stage('Build and Deploy') {
      // Both build and deploy run in the same stage to guarantee the same
      // Jenkins node/executor — the built image lives in that node's local
      // Docker daemon, so the deploy step is guaranteed to find it.
      agent any
      steps {
        sh 'docker build -t "${DEPLOY_IMAGE}" .'
        withCredentials([
          string(credentialsId: 'gemini-api-key', variable: 'GEMINI_API_KEY'),
          string(credentialsId: 'admin-token', variable: 'ADMIN_TOKEN'),
          string(credentialsId: 'debug-secret', variable: 'DEBUG_SECRET')
        ]) {
          sh '''
            docker rm -f simulador-credito-habitacao || true

            # Ensure the data volume is owned by the node user (UID 1000) so the
            # container (USER node) can read/write the SQLite files.
            # No-op on fresh volumes; fixes existing root-owned ones.
            docker run --rm \
              -v simulador-credito-habitacao-data:/data \
              alpine chown -R 1000:1000 /data

            docker run -d --name simulador-credito-habitacao -p 3999:3000 \
              -v simulador-credito-habitacao-data:/usr/src/app/data \
              -e GEMINI_API_KEY="${GEMINI_API_KEY}" \
              -e ADMIN_TOKEN="${ADMIN_TOKEN}" \
              -e DEBUG_SECRET="${DEBUG_SECRET}" \
              "${DEPLOY_IMAGE}"
          '''
        }
      }
    }

    stage('Aplicar Overrides (pontual)') {
      // Só corre quando marcas APPLY_OVERRIDES em "Build with Parameters".
      // Aplica seguros/spreads/LTV da auditoria via scripts/apply-overrides.js,
      // executado DENTRO do container já deployado (tem node + script + API + token).
      // Mantém OVERRIDES_DRY_RUN marcado para pré-ver; desmarca para gravar.
      when { expression { return params.APPLY_OVERRIDES } }
      agent any
      steps {
        sh '''
          DRY=""
          [ "${OVERRIDES_DRY_RUN}" = "true" ] && DRY="--dry-run"

          echo "A aguardar a app responder (máx ~60s)..."
          for i in $(seq 1 30); do
            curl -sf http://localhost:3999/api/banks >/dev/null 2>&1 && break
            sleep 2
          done

          echo "A correr apply-overrides.js ${DRY}..."
          docker exec -e BASE_URL=http://localhost:3000 -e ADMIN_TOKEN="${ADMIN_TOKEN}" \
            simulador-credito-habitacao node scripts/apply-overrides.js ${DRY}
        '''
      }
    }
  }

  post {
    always {
      script {
        node('') {
          withCredentials([string(credentialsId: 'discord-webhook-url', variable: 'WEBHOOK_URL')]) {
            script {
              def buildStatus = currentBuild.currentResult
              def statusMeta = [
                SUCCESS:  [emoji: "✅", color: 3066993],
                FAILURE:  [emoji: "❌", color: 15158332],
                UNSTABLE: [emoji: "⚠️", color: 16776960],
                ABORTED:  [emoji: "🛑", color: 9807270]
              ][buildStatus] ?: [emoji: "ℹ️", color: 3447003]

              def shortSha = (env.GIT_COMMIT ?: "unknown").take(7)
              def branch = env.GIT_BRANCH ?: "unknown"
              def buildUrl = env.BUILD_URL ?: ""
              def prUrl = env.CHANGE_URL ?: ""

              def stripEmbeddedGitCredentials = { raw ->
                if (!raw) return ""
                return raw.replaceAll(/^https?:\/\/[^@\/]+@/, "https://")
              }
              def normalizeRepoUrl = { raw ->
                if (!raw) return ""
                if (raw.startsWith("git@github.com:")) {
                  return "https://github.com/" + raw.substring("git@github.com:".length()).replaceAll(/\.git$/, "")
                }
                return raw.replaceAll(/\.git$/, "")
              }
              def rawGitUrl = stripEmbeddedGitCredentials(env.GIT_URL ?: "")
              def repoUrl = normalizeRepoUrl(rawGitUrl)
              def commitUrl = (repoUrl && env.GIT_COMMIT) ? "${repoUrl}/commit/${env.GIT_COMMIT}" : ""

              /** Parse owner/repo for github.com HTTPS URLs only (GitHub API). */
              def parseGithubOwnerRepo = { url ->
                if (!url) return null
                def u = url.trim().replaceAll(/\/$/, "")
                def m = u =~ /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)$/
                if (!m) return null
                return [owner: m[0][1], repo: m[0][2]]
              }

              def commitTitle = env.CHANGE_TITLE ?: ""
              def commitAuthor = env.CHANGE_AUTHOR_DISPLAY_NAME ?: env.CHANGE_AUTHOR ?: ""

              def ghRepo = parseGithubOwnerRepo(repoUrl)
              if (ghRepo && env.GIT_COMMIT) {
                try {
                  withCredentials([string(credentialsId: 'github-api-token', variable: 'GITHUB_TOKEN')]) {
                    def apiUrl = "https://api.github.com/repos/${ghRepo.owner}/${ghRepo.repo}/commits/${env.GIT_COMMIT}"
                    def authorizationHeader = 'Bearer '.concat(env.GITHUB_TOKEN as String)
                    def resp = httpRequest(
                      url: apiUrl,
                      httpMode: 'GET',
                      quiet: true,
                      customHeaders: [
                        [name: 'Authorization', value: authorizationHeader],
                        [name: 'Accept', value: 'application/vnd.github+json'],
                        [name: 'X-GitHub-Api-Version', value: '2022-11-28']
                      ],
                      validResponseCodes: '200'
                    )
                    def json = new groovy.json.JsonSlurper().parseText(resp.content.toString())
                    if (!commitTitle && json.commit?.message) {
                      commitTitle = json.commit.message.toString().split('\n')[0].trim()
                    }
                    def gitName = json.commit?.author?.name
                    def gitEmail = json.commit?.author?.email
                    def ghLogin = json.author?.login
                    if (gitName || gitEmail) {
                      commitAuthor = gitName ?: ghLogin ?: ""
                      if (gitEmail) commitAuthor += (commitAuthor ? " · " : "") + gitEmail
                    } else if (ghLogin) {
                      commitAuthor = ghLogin
                    }
                  }
                } catch (Exception e) {
                  echo "GitHub API commit lookup skipped: ${e.message}"
                }
              }

              try {
                def hasGit = sh(script: 'command -v git >/dev/null 2>&1', returnStatus: true) == 0
                if (hasGit) {
                  if (!commitTitle) {
                    def t = sh(script: 'git log -1 --pretty=%s', returnStdout: true).trim()
                    if (t) commitTitle = t
                  }
                  if (!commitAuthor || commitAuthor == "unknown") {
                    def a = sh(script: 'git log -1 --pretty=%an', returnStdout: true).trim()
                    if (a) commitAuthor = a
                  }
                }
              } catch (_) {
                // keep values from GitHub API / Jenkins env
              }
              if (!commitTitle) commitTitle = "Commit " + shortSha
              if (!commitAuthor) commitAuthor = "unknown"

              def links = []
              if (buildUrl) links << "[Build](${buildUrl})"
              if (commitUrl) links << "[Commit](${commitUrl})"
              if (prUrl) links << "[PR](${prUrl})"
              if (env.PUBLIC_APP_URL) links << "[Public App](${env.PUBLIC_APP_URL})"

              def embed = [
                title: "${statusMeta.emoji} Build ${buildStatus} · #${env.BUILD_NUMBER}",
                color: statusMeta.color,
                description: commitTitle ?: "No commit title available",
                url: buildUrl ?: null,
                fields: [
                  [name: "Project", value: env.JOB_NAME ?: "unknown", inline: true],
                  [name: "Branch", value: branch, inline: true],
                  [name: "Commit", value: shortSha, inline: true],
                  [name: "Author", value: commitAuthor, inline: true],
                  [name: "Image", value: env.DEPLOY_IMAGE ?: "unknown", inline: true],
                  [name: "Duration", value: currentBuild.durationString ?: "unknown", inline: true],
                  [name: "Links", value: links ? links.join(" · ") : "No links available", inline: false]
                ],
                timestamp: new Date().format("yyyy-MM-dd'T'HH:mm:ssXXX", TimeZone.getTimeZone("UTC"))
              ]

              def jsonBody = new groovy.json.JsonBuilder([embeds: [embed]]).toString()

              httpRequest(
                url: WEBHOOK_URL,
                httpMode: 'POST',
                contentType: 'APPLICATION_JSON',
                requestBody: jsonBody,
                validResponseCodes: '200,204'
              )

              sh 'docker ps --filter name=simulador-credito-habitacao --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'
            }
          }
        }
      }
    }
  }
}
