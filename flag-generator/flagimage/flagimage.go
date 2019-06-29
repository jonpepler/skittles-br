package flagimage

import (
	"github.com/ajstarks/svgo"
	"net/http"
	"fmt"
)

type Flag struct {
    layers   int
}

var ratio = 1.5
var flag_height = 500.0

var background_colour = "black"

func New(layers int, responseWriter http.ResponseWriter) Flag {
  f := Flag {layers}
 	responseWriter.Header().Set("Content-Type", "image/svg+xml")
  s := svg.New(responseWriter)
  s.Start(int(get_flag_width()), int(get_flag_height()))
  add_background(s, background_colour)
  s.Circle(375, 250, 125, "fill:none;stroke:red")
  s.End()
  return f
}

func add_background(s *svg.SVG, bg string) {
  s.Rect(0, 0, int(get_flag_width()), int(get_flag_height()), fmt.Sprintf("fill:%s", bg))
}

func (f Flag) Layers() int {
	return f.layers
}

func get_flag_height() float64 {
	return flag_height
}

func get_flag_width() float64 {
	return flag_height * ratio
}
