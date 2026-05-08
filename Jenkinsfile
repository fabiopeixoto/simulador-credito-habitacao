pipeline {
  agent any

  triggers {
    githubPush()
  }

  environment {
    DEPLOY_IMAGE = "simulador-credito-habitacao:${env.GIT_COMMIT ?: 'latest'}"
    ANTHROPIC_API_KEY = credentials('anthropic-api-key')
  }

  stages {
    stage('Checkout') {
      when {
        branch 'main'
      }
      steps {
        checkout scm
      }
    }

    stage('Validate') {
      when {
        branch 'main'
      }
      steps {
        sh 'node --check server.js'
      }
    }

    stage('Build Docker Image') {
      when {
        branch 'main'
      }
      steps {
        sh 'docker build -t "${DEPLOY_IMAGE}" .'
      }
    }

    stage('Deploy Container') {
      when {
        branch 'main'
      }
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
      sh 'docker ps --filter name=simulador-credito-habitacao --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'
    }
  }
}
