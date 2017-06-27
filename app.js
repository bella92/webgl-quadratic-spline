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
    '    gl_FragColor = vec4(fragColor, 1.0);',
    '}'
].join('\n')

var canvas = document.getElementById('webgl-canvas')
var gl = canvas.getContext('webgl')

var textCanvas = document.getElementById('text-canvas')
var ctx = textCanvas.getContext("2d");

var program

var degree = 2

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

var N = function(t, i, n) {
    if (n === 0) {
        if (t >= u[i] && t < u[i + 1]) {
            return 1
        } else {
            return 0
        }
    }

    var first = ((t - u[i]) / (u[i + n] - u[i])) * N(t, i, n - 1)
    var second = ((u[i + n + 1] - t) / (u[i + n + 1] - u[i + 1])) * N(t, i + 1, n - 1)

    if (isNaN(first)) {
        first = 0
    }

    if (isNaN(second)) {
        second = 0
    }

    return first + second
}

var s = function(t) {
    var result = {
        x: 0.0, 
        y: 0.0
    }

    for (var i = 0; i < d.length; i++) {
        var b = N(t, i, degree)

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
            knots.push({ x: value * 2 - 1, y: -0.9, r: 0, g: 0, b: 0, size: 3.0 })
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
    if (y > -0.75 && selectedControlPointIndex === null) {
        d.push({ x: x, y: y, r: 0, g: 0, b: 0, size: 3.0 })
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
    var minDelta = { x: 0.01, y: 0.01 }
    var closestControlPoint = null

    for (var i = 0; i < d.length; i++) {
        var deltaX = Math.abs(x - d[i].x)
        var deltaY = Math.abs(y - d[i].y)

        if (deltaX < minDelta.x && deltaY < minDelta.y) {
            closestControlPoint = d[i]
            minDelta = { x: deltaX, y: deltaY }
            selectedControlPointIndex = i
        }

        d[i].size = 3.0
        d[i].r = 0
        d[i].g = 0
        d[i].b = 0
    }

    if (closestControlPoint !== null) {
        closestControlPoint.size = 6.0
        closestControlPoint.r = 0.8
        closestControlPoint.g = 0.1
        closestControlPoint.b = 0.2
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

        knots[i].size = 3.0
        knots[i].r = 0
        knots[i].g = 0
        knots[i].b = 0
    }

    if (closestKnot !== null) {
        closestKnot.size = 6.0
        closestKnot.r = 0.8
        closestKnot.g = 0.1
        closestKnot.b = 0.2
    } else {
        selectedKnotIndex = null
    }

    drawScene()
}

var translateSelectedControlPoint = function(x, y) {
    if (y > -0.75 && selectedControlPointIndex !== null) {
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
        drawControlPolygon()
        drawSpline()
        drawKnots()
    }
}

var drawControlPolygon = function() {
    var splineControlPoints = []

    for (var i = 0; i < d.length; i++) {
        splineControlPoints = splineControlPoints.concat(Object.values(d[i]))
        drawLabel("d" + (i - 1), d[i].x, d[i].y)
    }

    drawPoints(splineControlPoints)
    drawLineStrip(splineControlPoints)
}

var drawKnots = function() {
    if (d.length > degree) {
        var knotVertices = []

        for (var i = 0; i < knots.length; i++) {
            knotVertices = knotVertices.concat(Object.values(knots[i]))
            drawLabel("u" + i, knots[i].x, knots[i].y)
        }

        drawPoints(knotVertices)
        drawLineStrip(knotVertices)
    }
}

var drawKnotsPane = function() {
    var knotsPaneVertices = [
        //Triangle 1
        -1, -0.75, 0.8, 0.8, 0.8, 3,
        1, -0.75, 0.8, 0.8, 0.8, 3,
        -1, -1, 0.8, 0.8, 0.8, 3,
        //Triangle 2
        1, -0.75, 0.8, 0.8, 0.8, 3,
        -1, -1, 0.8, 0.8, 0.8, 3,
        1, -1, 0.8, 0.8, 0.8, 3,
    ]

    drawTriangles(knotsPaneVertices)
}

var drawSpline = function() {
    if (d.length > degree) {
        var splineVertices = []

        for (var l = 0; l < u.length - 1; l++) {
            for (var t = u[l]; t < u[l + 1]; t+=0.005) {
                var point = s(t)

                splineVertices = splineVertices.concat([point.x, point.y, 0.8, 0.4, 0.9, 7.0])
            }
        }

        drawLineStrip(splineVertices)
    }
}

var clearCanvas = function() {
    gl.clearColor(0.7, 0.9, 0.8, 1.0)
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

var drawLabel = function(text, x, y) {
    offsetX = (canvas.width * (x + 1) / 2)
    offsetY = canvas.height - canvas.height * (y + 1) / 2

    ctx.textAlign = "center"
    ctx.fillStyle = "#000000"
    ctx.fillText(text, offsetX, offsetY - 10)
}