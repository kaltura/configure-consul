
@Library('kaltura')_

pipeline {

    agent { 
        label 'Ubuntu'
    }
    environment {
        version = sh(script: 'cat package.json | grep version | head -1 | awk -F: \'{ print $2 }\' | sed \'s/[",]//g\' | sed \'s/^ *//;s/ *$//\'', returnStdout: true).trim()
    }

    stages { 
        stage('Build') {
            steps {
                script {
                    docker.build("configure-consul:$BUILD_NUMBER", "--build-arg VERSION=$version .")
                }
            }
        }
        stage('Deploy') {
            steps {
                deploy('configure-consul', "$version")
            }
        }
    }
}