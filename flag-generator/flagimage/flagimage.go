package flagimage

import (
	"github.com/ajstarks/svgo"
	"github.com/lucasb-eyer/go-colorful"
	"io"
	"fmt"
	"math/rand"
	"math"
	"time"
)

type Flag struct {
  layers   int
}

type coord struct {
	x int
	y int
}

var ratio = 1.5
var flag_height = 500
var grid_size = 100
var anchor_points = generate_anchor_points()
var cornerPoints = []coord{
	coord{0, 0},
	coord{get_flag_width(), 0},
	coord{get_flag_width() / 2, 0},
	coord{get_flag_width() / 2, get_flag_height()},
	coord{0, get_flag_height()},
	coord{0, get_flag_height() / 2},
	coord{get_flag_width(), get_flag_height() / 2},
	coord{get_flag_width(), get_flag_height()},
}
var featurePoints = []coord{
	coord{get_flag_width() / 2, get_flag_height() / 2},
}

// New writes a SVG flag image to the provided responseWriter.
func New(layers int, responseWriter io.Writer) Flag {
	rand.Seed(time.Now().UnixNano())

  f := Flag {layers}

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
  s.Start(get_flag_width(), get_flag_height())

  add_background(s, colour_palette[0])

  for i := 0; i < layers; i++ {
  	colour := colour_palette[i + 1]
  	add_random_layer(s, colour)
  }

  s.End()
  return f
}

// Make new type, banner
// banners are same as rects, only guarrentee three points on edge of flag

func add_random_layer(s *svg.SVG, colour colorful.Color) {
	colour_string := colour.Hex()
	layerFuncs := []func(){
	    func() { // Full circles
	    	p := randomCircleCoord()
	    	r := rand.Intn(get_flag_height() / 2)
	    	s.Ellipse(p.x, p.y, r, r, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
	    },
	    func() { // Empty circles
	    	p := randomCircleCoord()
	    	r := rand.Intn(get_flag_height() / 2)
	    	s.Ellipse(p.x, p.y, r, r, fmt.Sprintf("fill:none;stroke:%s;stroke-width:100;", colour_string))
	    },
	    func() { // Rectangles
// TODO Rects need a quarter in point
	    	a := randomCornerCoord()
	    	b := randomCornerCoord()
	    	if a.x == get_flag_width() {
	    		a.x = 0
	    	}
	    	if a.y == get_flag_height() {
	    		a.y = 0
	    	}
	    	for (a.x >= b.x || a.y >= b.y) || isFlagSizeRect(a, b) {
	    		b = randomCornerCoord()
	    	}
	    	bVector := a.distance(b)
	    	s.Rect(a.x, a.y, abs(bVector.x), abs(bVector.y), fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
	    },
	    func() { // Triangles
	    	var triangleCoords []coord
	    	for len(triangleCoords) < 3 {
	    		p := randomCornerCoord()
	    		if !coordInArray(triangleCoords, p) {
	    			if (len(triangleCoords) != 2) || !pointsOnSameAxis(append(triangleCoords, p)...) {
	    				triangleCoords = append(triangleCoords, p)
	    			}
	    		}
	    	}

	    	xarr, yarr := splitCoordArray(triangleCoords)
	    	s.Polygon(xarr, yarr, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
	    },
	}
	layerFuncs[rand.Intn(len(layerFuncs))]()
}

func add_background(s *svg.SVG, bg colorful.Color) {
  s.Rect(0, 0, get_flag_width(), get_flag_height(), fmt.Sprintf("fill:%s", bg.Hex()))
}

func (f Flag) Layers() int {
	return f.layers
}

func get_flag_height() int {
	return flag_height
}

func get_flag_width() int {
	return int(float64(flag_height) * ratio)
}

func generate_anchor_points() (ap []coord) {
	for i := 0; i < get_flag_height(); i += grid_size {
		for j := 0; j < get_flag_width(); j += grid_size {
			ap = append(ap, coord{j, i})
		}
	}
	return
}

func randomAnchorCoord() coord {
	return anchor_points[rand.Intn(len(anchor_points))]
}

func randomCornerCoord() coord {
	return cornerPoints[rand.Intn(len(cornerPoints))]
}

func randomFeaturePoint() coord {
	return featurePoints[rand.Intn(len(featurePoints))]
}

func (p1 coord) distance(p2 coord) (vector coord) {
	vector = coord{p2.x - p1.x, p2.y - p1.y}
	return
}

func (p coord) isEdgePoint() bool {
	return (p.x == 0 || p.x == get_flag_width() || p.y == 0 || p.y == get_flag_height())
}

func abs(n int) int {
	return int(math.Abs(float64(n)))
}

func splitCoordArray(arr []coord) (xarr []int, yarr []int) {
	for _, v := range arr {
		xarr = append(xarr, v.x)
		yarr = append(yarr, v.y)
	}
	return
}

func coordInArray(arr []coord, p coord) bool {
	for _, v := range arr {
		if v == p {
			return true
		}
	}
	return false
}

func pointsOnSameAxis(points ...coord) bool {
	allEqual := func(arr []int) bool {
		if len(arr) == 1 {
			return true
		}

		var check int
		for i, v := range arr {
			if i != 1 && v != check {
				return false
			}
			check = v
		}
		return true
	}

	var xarr []int
	var yarr []int

	for _, v := range points {
		xarr = append(xarr, v.x)
		yarr = append(yarr, v.y)
	}

	return allEqual(xarr) || allEqual(yarr)
}

func isFlagSizeRect(a coord, b coord) bool {
	v := a.distance(b)
	return v.x == get_flag_width() && v.y == get_flag_height()
}

func addFeaturePoint(points ...coord) {
	featurePoints = append(featurePoints, points...)
}
