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

	starter_colour_palette, err := colorful.HappyPalette(6)
	if err != nil {
		fmt.Printf("Error generating happy palette: %v", err)
	}

	var colour_palette [6]colorful.Color
	for i, v := range starter_colour_palette {
		h, s, _ := v.Hsv()
		colour_palette[i] = colorful.Hsv(h, s, 100)
	}

  s := svg.New(responseWriter)
  s.Start(int(get_flag_width()), int(get_flag_height()))

  add_background(s, colour_palette[0])

  for i := 0; i < layers; i++ {
  	colour := colour_palette[i + 1]
  	add_random_layer(s, colour)
  }

  s.End()
  return f
}

func add_random_layer(s *svg.SVG, colour colorful.Color) {
	colour_string := colour.Hex()
	x, y, w, h := 100 * rand.Intn(5) + 175, 250, 250, 0
	h++
	layerFuncs := []func(){
	    func() { s.Circle(x, y, w/2, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string)) },
	    func() { s.Circle(x, y, w/2, fmt.Sprintf("fill:none;stroke:%s;stroke-width:10;", colour_string)) },
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
