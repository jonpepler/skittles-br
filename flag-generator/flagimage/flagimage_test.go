package flagimage_test

import (
	"."
	"testing"
	"os"
	"fmt"
	"bytes"
	"encoding/xml"
	"reflect"
)

type SVG struct {
  XMLName 	xml.Name 	`xml:"svg"`
  Rects     []Rect   	`xml:"rect"`
  Ellipses  []Ellipse `xml:"ellipse"`
  Polygons  []Polygon	`xml:"polygon"`
}

type Rect struct {
  XMLName xml.Name `xml:"rect"`
  X    		string   `xml:"x,attr"`
  Y    		string   `xml:"y,attr"`
  Width   string   `xml:"width,attr"`
  Height  string   `xml:"height,attr"`
  Style   string   `xml:"style,attr"`
}

type Ellipse struct {
  XMLName xml.Name `xml:"ellipse"`
  Cx    	string   `xml:"cx,attr"`
  Cy    	string   `xml:"cy,attr"`
  Rx    	string   `xml:"rx,attr"`
  Ry    	string   `xml:"ry,attr"`
  Style   string   `xml:"style,attr"`
}

type Polygon struct {
  XMLName xml.Name `xml:"polygon"`
  Points  string   `xml:"points,attr"`
  Style   string   `xml:"style,attr"`
}

func ExampleNew() {
	fmt.Print(flagimage.New(5, os.Stdout))
}

func TestNew(t *testing.T) {
	layerCount := 5
	buf := new(bytes.Buffer)
	flagimage.New(layerCount, buf)

	var svg SVG
	xml.Unmarshal([]byte(buf.String()), &svg)

	if reflect.DeepEqual(svg, SVG{}) {
		t.Error("flagimage.New returned badly formatted SVG.")
	}

	shapeCount := countShapes(svg)
	if shapeCount != layerCount {
		t.Error(fmt.Sprintf("Expected %d layers, but can see %d", layerCount, shapeCount))
	}
}

// Gets the number of shapes in the image, minus the default
// rect that spans the whole canvas
func countShapes(svg SVG) int {
	return len(svg.Rects) + len(svg.Ellipses) + len(svg.Polygons) - 1
}
