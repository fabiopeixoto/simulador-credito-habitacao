pipeline {
  // No global agent — Docker build/deploy run directly on the host where the
  // Docker daemon is available. Only the Validate stage uses a Docker container,
  // and it does NOT need the host Docker socket.
  agent none

  triggers {
    githubPush()
  }

  environment {
    DEPLOY_IMAGE = "simulador-credito-habitacao:${env.GIT_COMMIT ?: 'latest'}"
    ANTHROPIC_API_KEY = credentials('anthropic-api-key')
    ADMIN_TOKEN = credentials('admin-token')
    DEBUG_SECRET = credentials('debug-secret')
    PUBLIC_APP_URL = 'https://simulador-credito.tiagomartins.pt/'
  }

  stages {
    stage('Validate') {
      // Runs inside a clean Node.js container — no Docker socket needed.
      agent { docker { image 'node:20-slim' } }
      steps {
        sh '''
          for f in server.js api/banks.js api/spreads.js api/comments.js api/stats.js api/euribor.js; do
            node --check "$f" || exit 1
          done
        '''
      }
    }

    stage('Build and Deploy') {
      // Both build and deploy run in the same stage to guarantee the same
      // Jenkins node/executor — the built image lives in that node's local
      // Docker daemon, so the deploy step is guaranteed to find it.
      agent any
      steps {
        sh 'docker build -t "${DEPLOY_IMAGE}" .'
        sh '''
          docker rm -f simulador-credito-habitacao || true
          docker run -d --name simulador-credito-habitacao -p 3999:3000 \
            -v simulador-credito-habitacao-data:/usr/src/app/data \
            -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
            -e ADMIN_TOKEN="${ADMIN_TOKEN}" \
            -e DEBUG_SECRET="${DEBUG_SECRET}" \
            "${DEPLOY_IMAGE}"
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
