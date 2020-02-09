FROM golang:latest AS builder
WORKDIR /app
COPY . .
RUN make dependencies build

FROM alpine:latest  
COPY --from=builder /app/flag-generator .
CMD ["./flag-generator"]