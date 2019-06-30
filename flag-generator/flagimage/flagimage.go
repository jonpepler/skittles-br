package flagimage

import (
	"github.com/ajstarks/svgo"
	"github.com/lucasb-eyer/go-colorful"
	"net/http"
	"fmt"
	"math/rand"
)

type Flag struct {
    layers   int
}

var ratio = 1.5
var flag_height = 500.0

func New(layers int, responseWriter http.ResponseWriter) Flag {
  f := Flag {layers}
 	responseWriter.Header().Set("Content-Type", "image/svg+xml")

	colour_palette, err := colorful.HappyPalette(6)
	if err != nil {
		fmt.Printf("Error generating happy palette: %v", err)
	}

  s := svg.New(responseWriter)
  s.Start(int(get_flag_width()), int(get_flag_height()))

  add_background(s, colour_palette[0])

  for i := 0; i < layers; i++ {
  	colour := colour_palette[i + 1]
  	add_layer(s, 100 * i + 175, 250, 250, 0, colour)
  }

  s.End()
  return f
}

func add_layer(s *svg.SVG, x int, y int, w int, h int, colour colorful.Color) {
	colour_string := colour.Hex()
	layerFuncs := []func(){
	    func() { s.Circle(x, y, w/2, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string)) },
	    func() { s.Circle(x, y, w/2, fmt.Sprintf("fill:none;stroke:%s", colour_string)) },
	}
	layerFuncs[rand.Intn(len(layerFuncs))]()
}

func add_background(s *svg.SVG, bg colorful.Color) {
  s.Rect(0, 0, int(get_flag_width()), int(get_flag_height()), fmt.Sprintf("fill:%s", bg.Hex()))
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
