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
    DISCORD_WEBHOOK_URL = credentials('discord-webhook-url')
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
            -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
            "${DEPLOY_IMAGE}"
        '''
      }
    }
  }

  post {
    always {
      script {
        def buildStatus = currentBuild.currentResult
        def message = """
          **Build ${buildStatus}**
          Project: ${env.JOB_NAME}
          Build: #${env.BUILD_NUMBER}
          Branch: ${env.GIT_BRANCH ?: 'unknown'}
          Commit: ${env.GIT_COMMIT ?: 'unknown'}
          Duration: ${currentBuild.durationString}
        """.stripIndent()

        httpRequest(
          url: "${DISCORD_WEBHOOK_URL}",
          httpMode: 'POST',
          contentType: 'APPLICATION_JSON',
          requestBody: "{\"content\": \"${message}\"}"
        )
      }
      sh 'docker ps --filter name=simulador-credito-habitacao --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'
    }
  }
}
