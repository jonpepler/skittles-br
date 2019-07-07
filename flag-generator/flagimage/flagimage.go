package flagimage

import (
	"github.com/ajstarks/svgo"
	"github.com/lucasb-eyer/go-colorful"
	"io"
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
var flag_height = 500
var grid_size = 100
var anchor_points = generate_anchor_points()
var cornerPoints = []coord{
	coord{0, 0},
	coord{get_flag_width(), 0},
	coord{get_flag_width() / 2, 0},
	coord{get_flag_width() / 2, get_flag_height()},
	coord{get_flag_width() / 3, 0},
	coord{get_flag_width() / 3, get_flag_height()},
	coord{2 * get_flag_width() / 3, 0},
	coord{2 * get_flag_width() / 3, get_flag_height()},
	coord{0, get_flag_height()},
	coord{0, get_flag_height() / 2},
	coord{get_flag_width(), get_flag_height() / 2},
	coord{get_flag_width(), get_flag_height()},
}
var featurePoints []coord

// New writes a SVG flag image to the provided responseWriter.
func New(seed int64, responseWriter io.Writer) Flag {
	rand.Seed(seed)
	layers := 2 + rand.Intn(2)

  f := Flag {layers}

	resetFeaturePoints()

	var colour_palette = [...]colorful.Color{
		colorful.Color{0.807843137254902, 0.06666666666666667, 0.14901960784313725},
		colorful.Color{0, 0.2, 0.3568627450980392},
		colorful.Color{0.9882352941176471, 0.8196078431372549, 0.08627450980392157},
		colorful.Color{0.06274509803921569, 0.5019607843137255, 0.25882352941176473},
		colorful.Color{1, 0.5176470588235295, 0.18823529411764706},
		colorful.Color{0.4588235294117647, 0.6666666666666666, 0.8588235294117647},
		colorful.Color{0, 0, 0},
		colorful.Color{1, 1, 1},
	}

  s := svg.New(responseWriter)
  s.Start(get_flag_width(), get_flag_height())

  add_background(s, colour_palette[rand.Intn(len(colour_palette))])

  for i := 0; i < layers; i++ {
  	add_random_layer(s, colour_palette[rand.Intn(len(colour_palette))])
  }

  s.End()
  return f
}

func resetFeaturePoints() {
	featurePoints = []coord{
		coord{get_flag_width() / 2, get_flag_height() / 2},
	}
}

// Make new type, banner
// banners are same as rects, only guarrentee three points on edge of flag
func add_random_layer(s *svg.SVG, colour colorful.Color) {
	colour_string := colour.Hex()
	layerFuncs := []func(*svg.SVG, string){
			addFilledCircleLayer,
			addEmptyCircleLayer,
			addRectLayer,
			addTriangleLayer,
	}
	layerFuncs[rand.Intn(len(layerFuncs))](s, colour_string)
}

func addFilledCircleLayer(s *svg.SVG, colour_string string) {
	p := randomFeaturePoint()
	r := rand.Intn(get_flag_height() / 2)
	s.Ellipse(p.x, p.y, r, r, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))

}

func addEmptyCircleLayer(s *svg.SVG, colour_string string) {
	p := randomFeaturePoint()
	r := rand.Intn(get_flag_height() / 2)
	s.Ellipse(p.x, p.y, r, r, fmt.Sprintf("fill:none;stroke:%s;stroke-width:100;", colour_string))
}

func addRectLayer(s *svg.SVG, colour_string string) {
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

	// addCirclePoint(generateCirclePointsFromRect(a, b))

	s.Rect(a.x, a.y, abs(bVector.x), abs(bVector.y), fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
}

func addTriangleLayer(s *svg.SVG, colour_string string) {
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

	// addCirclePoint(generateCirclePointsFromTriangle(triangleCoords))

	s.Polygon(xarr, yarr, fmt.Sprintf("fill:%s;stroke:%s", colour_string, colour_string))
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
