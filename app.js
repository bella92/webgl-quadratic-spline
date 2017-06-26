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

var canvas = document.getElementById('canvas')
var gl = canvas.getContext('webgl')
var program

var degree = 2

var u = []
var d = []

var selectedControlPointIndex = null

var init = function() {
    if (!gl) {
        console.log('This browser does not support WebGL, falling back to experimental-webgl')
        gl = canvas.getContext('experimental-webgl')
    }

    if (!gl) {
        alert('This browser does not support WebGL')
    }

    gl.clearColor(0.7, 0.9, 0.8, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

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

    canvas.addEventListener("mousemove", function(e) {
        var x = 2 * e.offsetX / canvas.width - 1
        var y = 2 * (canvas.height - e.offsetY) / canvas.height - 1

        if (e.buttons === 0) {
            selectNearControlPoint(x, y)
        } else if (e.buttons === 1) {
            translateSelectedControlPoint(x, y)
        }
    })

    canvas.addEventListener("mousedown", function(e) {
        var x = 2 * e.offsetX / canvas.width - 1
        var y = 2 * (canvas.height - e.offsetY) / canvas.height - 1

        // for (var i = 0; i < d.length; i++) {
        //     var deltaX = Math.abs(x - d[i].x)
        //     var deltaY = Math.abs(y - d[i].y)

        //     if (deltaX < 0.01 && deltaY < 0.01) {
        //         selectedControlPointIndex = i
        //         break
        //     }
        // }

        if (e.buttons === 1) {
            if (selectedControlPointIndex === null) {
                addControlPoint(x, y)
            }
        } else if (e.buttons === 2) {
            deleteSelectedControlPoint()
        }
    })

    canvas.addEventListener("mouseup", function(e) {
        selectedControlPointIndex = null
    })

    canvas.addEventListener('contextmenu', function(e) {
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

    var first = (t - u[i]) / (u[i + n] - u[i]) * N(t, i, n - 1)
    var second = (u[i + n + 1] - t) / (u[i + n + 1] - u[i + 1]) * N(t, i + 1, n - 1)

    return first + second
}

var s = function(t, n, d) {
    var result = {
        x: 0.0, 
        y: 0.0
    }

    for (var i = 0; i < d.length; i++) {
        var b = N(t, i, n)

        result.x += d[i].x * b
        result.y += d[i].y * b
    }

    return result
}

var calculateKnots = function(n, p) {
    var result = []
    var m = n + p + 1

    // for (var i = 0; i <= m; i++) {
    //     if (i <= p) {
    //         result[i] = 0
    //     } else if (p < i && i <= n) {
    //         result[i] = (i - p)/(n - p + 1)
    //     } else {
    //         result[i] = 1
    //     }
    // }

    for (var i = 0; i <= m; i++) {
        result.push(i)
    }

    return result
}

var drawPoints = function(vertices) {
    draw(vertices, gl.POINTS)
}

var drawLineStrip = function(vertices) {
    draw(vertices, gl.LINE_STRIP)
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
    d.push({ x: x, y: y, r: 0, g: 0, b: 0, size: 3.0 })
    drawScene()
}

var deleteSelectedControlPoint = function() {
    if (selectedControlPointIndex !== null) {
        d.splice(selectedControlPointIndex, 1)
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

var translateSelectedControlPoint = function(x, y) {
    if (selectedControlPointIndex !== null) {
        d[selectedControlPointIndex].x = x
        d[selectedControlPointIndex].y = y
                
        drawScene()
    }
}

var drawScene = function() {
    if (d.length > 0) {
        u = calculateKnots(degree, d.length - 1)

        clearCanvas()
        drawControlPolygon()
        drawSpline()
    }
}

var drawControlPolygon = function() {
    var splineControlPoints = []

    for (var i = 0; i < d.length; i++) {
        splineControlPoints = splineControlPoints.concat(Object.values(d[i]))
    }

    drawPoints(splineControlPoints)
    drawLineStrip(splineControlPoints)
}

var drawSpline = function() {
    var splineVertices = []

    for (var l = 2; l < u.length - 3; l++) {
        for (var t = u[l]; t < u[l + 1]; t+=0.05) {
            var point = s(t, degree, d)

            splineVertices = splineVertices.concat([point.x, point.y, 0.8, 0.4, 0.9, 7.0])
        }
    }

    if (splineVertices.length > 0) {
        drawLineStrip(splineVertices)
    }
}

var clearCanvas = function() {
    gl.clearColor(0.7, 0.9, 0.8, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
}

var reset = function(e) {
    splineControlPoints = []
    splineVertices = []

    d = []
    u = []

    selectedControlPointIndex = null

    clearCanvas()
}