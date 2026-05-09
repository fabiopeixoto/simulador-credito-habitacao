pipeline {
  agent {
    docker {
      image 'node:20-slim'
      args '-v /var/run/docker.sock:/var/run/docker.sock'
    }
  }

  triggers {
    githubPush()
  }

  environment {
    DEPLOY_IMAGE = "simulador-credito-habitacao:${env.GIT_COMMIT ?: 'latest'}"
    ANTHROPIC_API_KEY = credentials('anthropic-api-key')
  }

  stages {
    stage('Validate') {
      steps {
        sh 'node --check server.js'
      }
    }

    stage('Build Docker Image') {
      steps {
        sh 'docker build -t "${DEPLOY_IMAGE}" .'
      }
    }

    stage('Deploy Container') {
      steps {
        sh '''
          docker rm -f simulador-credito-habitacao || true
          docker run -d --name simulador-credito-habitacao -p 3999:3000 \
            -v simulador-credito-habitacao-data:/usr/src/app/data \
            -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
            "${DEPLOY_IMAGE}"
        '''
      }
    }
  }

  post {
    always {
      withCredentials([string(credentialsId: 'discord-webhook-url', variable: 'WEBHOOK_URL')]) {
        script {
          def buildStatus = currentBuild.currentResult
          def message = "**Build ${buildStatus}**\nProject: ${env.JOB_NAME}\nBuild: #${env.BUILD_NUMBER}\nBranch: ${env.GIT_BRANCH ?: 'unknown'}\nCommit: ${env.GIT_COMMIT ?: 'unknown'}\nDuration: ${currentBuild.durationString}"
          def jsonBody = new groovy.json.JsonBuilder([content: message]).toString()

          httpRequest(
            url: WEBHOOK_URL,
            httpMode: 'POST',
            contentType: 'APPLICATION_JSON',
            requestBody: jsonBody,
            validResponseCodes: '200,204'
          )
        }
      }
      sh 'docker ps --filter name=simulador-credito-habitacao --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'
    }
  }
}
