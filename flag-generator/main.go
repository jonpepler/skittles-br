package main

import (
	"fmt"
	"log"
	"net/http"
	"encoding/json"

	"github.com/gorilla/mux"

	"./flagimage"

	"time"
)

func main() {
	log.Print("Starting...")
	router := mux.NewRouter()

	router.HandleFunc("/test", test).Methods(http.MethodGet)
	router.HandleFunc("/random-flag", generate_flag).Methods(http.MethodGet)

	log.Fatal(http.ListenAndServe(":3002", router))
}

func test(responseWriter http.ResponseWriter, request *http.Request) {
	log.Print("Test")
	writeResult(responseWriter, "testing")
}

func generate_flag(responseWriter http.ResponseWriter, request *http.Request) {
	log.Print("Making Flag")
 	responseWriter.Header().Set("Content-Type", "image/svg+xml")
	flagimage.New(time.Now().UnixNano(), responseWriter)
}

// writeResult writes the value as JSON to the response. If the encoding fails 500 is returned with a message.
func writeResult(responseWriter http.ResponseWriter, val interface{}) {
	log.Print("Writing...")
	enc := json.NewEncoder(responseWriter)
	err := enc.Encode(val)
	if err != nil {
		responseWriter.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(responseWriter, "failed to encode response: %v", err)
	}

	responseWriter.Header().Add("Content-Type", "application/json")
}
