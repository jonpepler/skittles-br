package flagimage

import (
	"github.com/ajstarks/svgo"
	"github.com/lucasb-eyer/go-colorful"
	"net/http"
	"fmt"
	"math/rand"
	"math"
)

type Flag struct {
  layers   int
}

type coord struct {
	x int
	y int
}

var ratio = 1.5
var flag_height = 500.0
var grid_size = 50
var anchor_points = generate_anchor_points()

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
	layerFuncs := []func(){
	    func() {
	    	x, y := rand.Intn(int(get_flag_width())), rand.Intn(int(get_flag_height()))
	    	r := rand.Intn(int(get_flag_height()) / 2)
	    	s.Ellipse(x, y, r, r, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
	    },
	    func() {
	    	x, y := rand.Intn(int(get_flag_width())), rand.Intn(int(get_flag_height()))
	    	r := rand.Intn(int(get_flag_height()) / 2)
	    	s.Ellipse(x, y, r, r, fmt.Sprintf("fill:none;stroke:%s;stroke-width:10;", colour_string))
	    },
	    func() {
	    	a := anchor_points[rand.Intn(len(anchor_points))]
	    	b := a.distance(anchor_points[rand.Intn(len(anchor_points))])
	    	s.Rect(a.x, a.y, abs(b.x), abs(b.y), fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
	    },
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

func generate_anchor_points() (ap []coord) {
	for i := 0; i < int(get_flag_height()); i += grid_size {
		for j := 0; j < int(get_flag_width()); j += grid_size {
			ap = append(ap, coord{j, i})
		}
	}
	return
}

func (p1 coord) distance(p2 coord) (vector coord) {
	vector = coord{p2.x - p1.x, p2.y - p1.y}
	return
}

func abs(n int) int {
	return int(math.Abs(float64(n)))
}
