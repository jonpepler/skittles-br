```
make

make run

curl http://localhost:3001/random-flag
```

## Install

You'll need an environment with Docker and Go 1.12.

For manual installation see these links:

Docker:
https://docs.docker.com/install/

Go:
https://golang.org/dl/

## Build and Run

```
make

make run
```

Make will run `go get` to fetch dependencies, build the go file, and then create the container.

You can ignore the warning: "go get: no install location for directory /home/vagrant/coupon-renderer-mock outside GOPATH"

Test it:

```
curl http://localhost:3001/random-flag
```

or open the URL in your browser as the ports are forwarded.

## Clean
```
make clean
```

### Go Build Note

It is possible to use `go build` to create a binary but this won't give a static binary suitable for use
in a container. See: 
http://blog.wrouesnel.com/articles/Totally%20static%20Go%20builds/

https://github.com/golang/go/issues/26492
