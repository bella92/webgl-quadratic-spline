var vertexShaderText = [
    'precision mediump float;',
    '',
    'attribute vec2 vertPosition;',
    'attribute vec3 vertColor;',
    'attribute float vertSize;',
    'varying vec3 fragColor;',
    '',
    'void main()',
    '{',
    '    fragColor = vertColor;',
    '    gl_Position = vec4(vertPosition, 0.0, 1.0);',
    '    gl_PointSize = vertSize;',
    '}'
].join('\n')

var fragmentShaderText = [
    'precision mediump float;',
    '',
    'varying vec3 fragColor;',
    '',
    'void main()',
    '{',
         'float r = 0.0, delta = 0.0;',
         'vec2 cxy = 2.0 * gl_PointCoord - 1.0;',
         'r = dot(cxy, cxy);',
         'if (r > 1.0) {',
         '    discard;',
         '}',
    '    gl_FragColor = vec4(fragColor, 1.0);',
    '}'
].join('\n')

var degree = 2

var canvas = document.getElementById('webgl-canvas')
var gl = canvas.getContext('webgl')

var textCanvas = document.getElementById('text-canvas')
var ctx = textCanvas.getContext("2d")

var currentDegree = document.getElementById('current-degree')
currentDegree.value = degree

var program

var u = []
var d = []

var knots = []

var selectedControlPointIndex = null
var selectedKnotIndex = null

var init = function() {
    if (!gl) {
        console.log('This browser does not support WebGL, falling back to experimental-webgl')
        gl = canvas.getContext('experimental-webgl')
    }

    if (!gl) {
        alert('This browser does not support WebGL')
    }

    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)

    gl.shaderSource(vertexShader, vertexShaderText)
    gl.shaderSource(fragmentShader, fragmentShaderText)

    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling vertex shader', gl.getShaderInfoLog(vertexShader))
        return
    }

    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling fragment shader', gl.getShaderInfoLog(fragmentShader))
        return
    }

    program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('ERROR linking program', gl.getProgramInfoLog(program))
        return
    }

    gl.validateProgram(program)

    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('ERROR validating program', gl.getProgramInfoLog(program))
        return
    }

    gl.useProgram(program)

    clearCanvas()

    textCanvas.addEventListener("mousemove", function(e) {
        var x = 2 * e.offsetX / canvas.width - 1
        var y = 2 * (canvas.height - e.offsetY) / canvas.height - 1

        if (e.buttons === 0) {
            selectNearControlPoint(x, y)
            selectNearKnot(x, y)
        } else if (e.buttons === 1) {
            translateSelectedControlPoint(x, y)
            slideKnot(x)
        }
    })

    textCanvas.addEventListener("mousedown", function(e) {
        var x = 2 * e.offsetX / canvas.width - 1
        var y = 2 * (canvas.height - e.offsetY) / canvas.height - 1

        if (e.buttons === 1) {
            addControlPoint(x, y)
        } else if (e.buttons === 2) {
            deleteSelectedControlPoint()
        }
    })

    textCanvas.addEventListener("mouseup", function(e) {
        selectedControlPointIndex = null
        selectedKnotIndex = null
    })

    textCanvas.addEventListener('contextmenu', function(e) {
        e.preventDefault()

        return false
    })
}

var N = function(x, i, n) {
    if (n === 0) {
        if (x >= u[i] && x < u[i + 1]) {
            return 1
        } else {
            return 0
        }
    }

    var first = ((x - u[i]) / (u[i + n] - u[i])) * N(x, i, n - 1)
    var second = ((u[i + n + 1] - x) / (u[i + n + 1] - u[i + 1])) * N(x, i + 1, n - 1)

    if (isNaN(first)) {
        first = 0
    }

    if (isNaN(second)) {
        second = 0
    }

    return first + second
}

var s = function(x) {
    var result = {
        x: 0.0, 
        y: 0.0
    }

    for (var i = 0; i < d.length; i++) {
        var b = N(x, i, degree)

        result.x += d[i].x * b
        result.y += d[i].y * b
    }

    return result
}

var calculateKnots = function() {
    if (d.length > degree) {
        knots = []

        for (var i = 0; i < d.length - degree + 1; i++) {
            var value = i / (d.length - degree) * 0.95 + 0.025
            knots.push({ x: value * 2 - 1, y: -0.77, r: 0.05, g: 0.24, b: 0.23, size: 8.0 })
        }

        calculateKnotsVector()
    }
}

var calculateKnotsVector = function() {
    u = []

    for (var i = 0; i < degree; i++) {
        u.push(0)
    }

    for (var i = 0; i < knots.length; i++) {
        u.push(Math.round((((knots[i].x + 1) / 2 - 0.025) / 0.95) * 100) / 100)
    }
    
    for (var i = 0; i < degree; i++) {
        u.push(1)
    }
}

var drawPoints = function(vertices) {
    draw(vertices, gl.POINTS)
}

var drawLineStrip = function(vertices) {
    draw(vertices, gl.LINE_STRIP)
}

var drawTriangles = function(vertices) {
    draw(vertices, gl.TRIANGLES)
}

var draw = function(vertices, mode) {
    var vertexBufferObject = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

    var positionAttribLocation = gl.getAttribLocation(program, 'vertPosition')
    var colorAttribLocation = gl.getAttribLocation(program, 'vertColor')
    var sizeAttribLocation = gl.getAttribLocation(program, 'vertSize')

    gl.vertexAttribPointer(
        positionAttribLocation, // Attribute location 
        2, // Number of elements per attribute
        gl.FLOAT, // Type of elements
        gl.FALSE,
        6 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
        0 // Offset from the beginning of a single vertex to this attribute
    )

    gl.vertexAttribPointer(
        colorAttribLocation, // Attribute location 
        3, // Number of elements per attribute
        gl.FLOAT, // Type of elements
        gl.FALSE,
        6 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
        2 * Float32Array.BYTES_PER_ELEMENT // Offset from the beginning of a single vertex to this attribute
    )

    gl.vertexAttribPointer(
        sizeAttribLocation, // Attribute location 
        1, // Number of elements per attribute
        gl.FLOAT, // Type of elements
        gl.FALSE,
        6 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
        5 * Float32Array.BYTES_PER_ELEMENT // Offset from the beginning of a single vertex to this attribute
    )

    gl.enableVertexAttribArray(positionAttribLocation)
    gl.enableVertexAttribArray(colorAttribLocation)
    gl.enableVertexAttribArray(sizeAttribLocation)

    gl.drawArrays(mode, 0, vertices.length / 6)
}

var addControlPoint = function(x, y) {
    if (y > -0.65 && selectedControlPointIndex === null) {
        d.push({ x: x, y: y, r: 0.75, g: 0.12, b: 0.08, size: 8.0 })
        calculateKnots()
        drawScene()
    }
}

var deleteSelectedControlPoint = function() {
    if (selectedControlPointIndex !== null) {
        d.splice(selectedControlPointIndex, 1)
        calculateKnots()
        drawScene()
    }
}

var selectNearControlPoint = function(x, y) {
    var minDelta = { x: 0.015, y: 0.015 }
    var closestControlPoint = null

    for (var i = 0; i < d.length; i++) {
        var deltaX = Math.abs(x - d[i].x)
        var deltaY = Math.abs(y - d[i].y)

        if (deltaX < minDelta.x && deltaY < minDelta.y) {
            closestControlPoint = d[i]
            minDelta = { x: deltaX, y: deltaY }
            selectedControlPointIndex = i
        }

        d[i].size = 8.0
        d[i].r = 0.75
        d[i].g = 0.12
        d[i].b = 0.08
    }

    if (closestControlPoint !== null) {
        closestControlPoint.size = 10.0
        closestControlPoint.r = 1
        closestControlPoint.g = 0.44
        closestControlPoint.b = 0.44
    } else {
        selectedControlPointIndex = null
    }

    drawScene()
}

var selectNearKnot = function(x, y) {
    var minDelta = { x: 0.01, y: 0.01 }
    var closestKnot = null

    for (var i = 1; i < knots.length - 1; i++) {
        var deltaX = Math.abs(x - knots[i].x)
        var deltaY = Math.abs(y - knots[i].y)

        if (deltaX < minDelta.x && deltaY < minDelta.y) {
            closestKnot = knots[i]
            minDelta = { x: deltaX, y: deltaY }
            selectedKnotIndex = i
        }

        knots[i].size = 8.0
        knots[i].r = 0.05
        knots[i].g = 0.24
        knots[i].b = 0.23
    }

    if (closestKnot !== null) {
        closestKnot.size = 10.0
        closestKnot.r = 0.13
        closestKnot.g = 0.68
        closestKnot.b = 0.65
    } else {
        selectedKnotIndex = null
    }

    drawScene()
}

var translateSelectedControlPoint = function(x, y) {
    if (y > -0.65 && selectedControlPointIndex !== null) {
        d[selectedControlPointIndex].x = x
        d[selectedControlPointIndex].y = y
                
        drawScene()
    }
}

var slideKnot = function(x) {
    if (selectedKnotIndex !== null) {
        if (knots[selectedKnotIndex - 1].x < x && x < knots[selectedKnotIndex + 1].x) {
            knots[selectedKnotIndex].x = x
        }
                
        calculateKnotsVector()
        drawScene()
    }
}

var drawScene = function() {
    if (d.length > 0) {
        clearCanvas()
        drawSpline()
        drawControlPolygon()
        drawKnots()

        if (degree === 2) {
            calculateQuadraticBezierControlPoints()
        } else {
            calculateCubicBezierControlPoints()
        }
    }
}

var drawControlPolygon = function() {
    var splineControlPoints = []

    for (var i = 0; i < d.length; i++) {
        splineControlPoints = splineControlPoints.concat(Object.values(d[i]))
        drawLabel("d" + (i - 1), d[i].x, d[i].y, 1, "#bf1f14")
    }

    drawPoints(splineControlPoints)
    drawLineStrip(splineControlPoints)
}

var drawKnots = function() {
    if (d.length > degree) {
        var knotVertices = []

        for (var i = 0; i < knots.length; i++) {
            knotVertices = knotVertices.concat(Object.values(knots[i]))
            drawLabel("u" + i, knots[i].x, knots[i].y, 1, "#bf1f14")
        }

        drawPoints(knotVertices)
        drawLineStrip(knotVertices)
    }
}

var drawKnotsPane = function() {
    var r = 0.27
    var g = 0.53
    var b = 0.51

    var knotsPaneVertices = [
        //Triangle 1
        -1, -0.65, r, g, b, 3,
        1, -0.65, r, g, b, 3,
        -1, -1, r, g, b, 3,
        //Triangle 2
        1, -0.65, r, g, b, 3,
        -1, -1, r, g, b, 3,
        1, -1, r, g, b, 3,
    ]

    drawTriangles(knotsPaneVertices)
}

var drawSpline = function() {
    if (d.length > degree) {
        var splineVertices = []

        for (var l = 0; l < u.length - 1; l++) {
            for (var t = u[l]; t < u[l + 1]; t+=0.0005) {
                var point = s(t)

                splineVertices = splineVertices.concat([point.x, point.y, 0.05, 0.24, 0.23, 7.0])
            }
        }

        drawLineStrip(splineVertices)
    }
}

var clearCanvas = function() {
    gl.clearColor(0.90, 1, 0.96, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    drawKnotsPane()
}

var reset = function(e) {
    splineControlPoints = []
    splineVertices = []

    d = []
    u = []
    knots = []

    selectedControlPointIndex = null
    selectedKnotIndex = null

    clearCanvas()
}

var drawLabel = function(text, x, y, direction, color) {
    if (!direction) {
        direction = 1
    }

    offsetX = (canvas.width * (x + 1) / 2)
    offsetY = canvas.height - canvas.height * (y + 1) / 2

    ctx.textAlign = "center"
    ctx.fillStyle = color
    ctx.font = "bold 10pt Courier"

    if (direction === -1) {
        direction *= 1.7
    }

    ctx.fillText(text, offsetX, offsetY - (direction * 10))
}

var setDegree = function() {
    degree = parseInt(currentDegree.value, 10)
    reset()
}

var b = []

var calculateCubicBezierControlPoints = function() {
    b = []

    if (d.length > degree) {
        b[0] = {x: d[0].x, y: d[0].y, r: 0, g: 0.4, b: 1, size: 5}
        b[1] = {x: d[1].x, y: d[1].y, r: 0, g: 0.4, b: 1, size: 5}

        for (var i = 2; i < d.length - 2; i++) {
            b[3 * i - 2] = {
                x: ((deltaI(i) + deltaI(i + 1)) / delta(i + 1)) * d[i].x + ((deltaI(i - 1)) / delta(i + 1)) * d[i + 1].x,
                y: ((deltaI(i) + deltaI(i + 1)) / delta(i + 1)) * d[i].y + ((deltaI(i - 1)) / delta(i + 1)) * d[i + 1].y,
                r: 0,
                g: 0.4,
                b: 1,
                size: 5
            }
        }

        for (var i = 1; i < d.length - 3; i++) {
            b[3 * i - 1] = {
                x: (deltaI(i + 1) / delta(i + 1)) * d[i].x + ((deltaI(i - 1) + deltaI(i)) / delta(i + 1)) * d[i + 1].x,
                y: (deltaI(i + 1) / delta(i + 1)) * d[i].y + ((deltaI(i - 1) + deltaI(i)) / delta(i + 1)) * d[i + 1].y,
                r: 0,
                g: 0.4,
                b: 1,
                size: 5
            }
        }

        var l = d.length - 3

        b[3 * l - 1] = {x: d[l + 1].x, y: d[l + 1].y, r: 0, g: 0.4, b: 1, size: 5}
        b[3 * l] = {x: d[l + 2].x, y: d[l + 2].y, r: 0, g: 0.4, b: 1, size: 5}

        for (var i = 1; i < l; i++) {
            b[3 * i] = {
                x: (deltaI(i + 1) / (deltaI(i) + deltaI(i + 1))) * b[3 * i - 1].x + (deltaI(i) / (deltaI(i) + deltaI(i + 1))) * b[3 * i + 1].x,
                y: (deltaI(i + 1) / (deltaI(i) + deltaI(i + 1))) * b[3 * i - 1].y + (deltaI(i) / (deltaI(i) + deltaI(i + 1))) * b[3 * i + 1].y,
                r: 0,
                g: 0.4,
                b: 1,
                size: 5
            }
        }

        drawBezierControlPoints()
    }
}

var calculateQuadraticBezierControlPoints = function() {
    b = []

    if (d.length > degree) {
        b[0] = {x: d[0].x, y: d[0].y, r: 0, g: 0.4, b: 1, size: 5}

        for (var i = 0; i < d.length - 1; i++) {
            b[2 * i - 1] = {
                x: d[i].x,
                y: d[i].y,
                r: 0,
                g: 0.4,
                b: 1,
                size: 5
            }
        }

        for (var i = 1; i < d.length - 2; i++) {
            b[2 * i] = {
                x: (deltaI(i + 1) / delta(i + 1)) * b[2 * i - 1].x + ((deltaI(i)) / delta(i + 1)) * b[2 * i + 1].x,
                y: (deltaI(i + 1) / delta(i + 1)) * b[2 * i - 1].y + ((deltaI(i)) / delta(i + 1)) * b[2 * i + 1].y,
                r: 0,
                g: 0.4,
                b: 1,
                size: 5
            }
        }
        
        var l = d.length - 2

        b[2 * l] = {x: d[l + 1].x, y: d[l + 1].y, r: 0, g: 0.4, b: 1, size: 5}

        drawBezierControlPoints()
    }
}

var drawBezierControlPoints = function() {
    var bezierPoints = []

    for (var i = 0; i < b.length; i++) {
        if (b[i]) {
            bezierPoints = bezierPoints.concat(Object.values(b[i]))
            drawLabel("b" + i, b[i].x, b[i].y, -1, "#0066ff")
        }
    }

    drawPoints(bezierPoints)
    drawLineStrip(bezierPoints)
}

var deltaI = function(i) {
    var index = i + degree - 1
    return u[index + 1] - u[index]
}

var delta = function(i) {
    if (degree === 2) {
        return deltaI(i - 1) + deltaI(i)
    } else {
        return deltaI(i - 2) + deltaI(i - 1) + deltaI(i)
    }
}