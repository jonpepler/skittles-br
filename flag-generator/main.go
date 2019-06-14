package main

import (
	"fmt"
	"log"
	"net/http"
	"encoding/json"

	"github.com/gorilla/mux"

	"github.com/ajstarks/svgo"
)

func main() {
	router := mux.NewRouter()

	router.HandleFunc("/test", test).Methods(http.MethodGet)
	router.HandleFunc("/random-flag", generate_flag).Methods(http.MethodGet)

	log.Fatal(http.ListenAndServe(":3001", router))
}

func test(responseWriter http.ResponseWriter, request *http.Request) {
	writeResult(responseWriter, "testing")
}

func generate_flag(responseWriter http.ResponseWriter, request *http.Request) {
  responseWriter.Header().Set("Content-Type", "image/svg+xml")
  s := svg.New(responseWriter)
  s.Start(500, 500)
  s.Circle(250, 250, 125, "fill:none;stroke:black")
  s.End()
}

// writeResult writes the value as JSON to the response. If the encoding fails 500 is returned with a message.
func writeResult(responseWriter http.ResponseWriter, val interface{}) {
	enc := json.NewEncoder(responseWriter)
	err := enc.Encode(val)
	if err != nil {
		responseWriter.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(responseWriter, "failed to encode response: %v", err)
	}

	responseWriter.Header().Add("Content-Type", "application/json")
}
