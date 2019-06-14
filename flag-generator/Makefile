CONTAINER_NAME=flag-generator
VERSION=1.0

all: dependencies build docker-build

dependencies:
# 	Ignore installation directory error
	go get ; true

build:
	CGO_ENABLED=0 GOOS=linux go build -o ${CONTAINER_NAME} -a -ldflags '-extldflags "-static"' .

docker-build:
	docker build -t ${CONTAINER_NAME}:${VERSION} .

run:
	docker run -p 3001:3001 --name ${CONTAINER_NAME} -d ${CONTAINER_NAME}:${VERSION}

stop:
	docker stop ${CONTAINER_NAME}

rm:
	docker rm ${CONTAINER_NAME}

down: stop rm

clean:
	rm -f flag-generator
