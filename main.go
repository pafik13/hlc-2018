package main

import "net/http"

func DumbHandler(writer http.ResponseWriter, request *http.Request) {
    writer.Write([]byte("Hello, I'm Web Server!"))
}

func main () {
    http.HandleFunc("/", DumbHandler)
    http.ListenAndServe(":80", nil)
}