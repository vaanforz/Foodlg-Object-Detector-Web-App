/* eslint-env jquery */
/* eslint-env browser */

'use strict';

// canvas colors
const COLOR_NORMAL = '#00FF00'; // Lime
const COLOR_HIGHLIGHT = '#FFCC33'; // Yellow
const COLOR_TEXT = '#000000'; // Black

// global vars
var threshold = 0.1;
var highlight = '';
var filter_list = [];
var predictions = [];

// Refreshes the label icons visibility
function updateLabelIcons() {
  $('.label-icon').hide();
  for (var i = 0; i < predictions.length; i++) {
    var icon_id = '#label-icon-' + predictions[i]['label_id'];
    if (predictions[i]['probability'] > threshold) {
      $(icon_id).show();
    }
  }
}

// a visibility filter for threshold and and label blacklist
function displayBox(i) {
  return predictions[i]['probability'] > threshold
    && !filter_list.includes(predictions[i]['label_id']);
}

function clearCanvas() {
  $('#image-display').empty(); // removes previous img and canvas
  predictions = []; // remove any previous metadata
  updateLabelIcons(); // reset label icons
}

// (re)paints canvas (if canvas exists) and triggers label visibility refresh
function paintCanvas() {
  updateLabelIcons();

  if ($('#image-canvas').length) {

    var ctx = $('#image-canvas')[0].getContext('2d');
    var can = ctx.canvas;

    var img = $('#user-image');
    can.width = img.width();
    can.height = img.height();

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.font = '16px "IBM Plex Sans"';
    ctx.textBaseline = 'top';
    ctx.lineWidth = '3';

    for (var i = 0; i < predictions.length; i++) {
      if (displayBox(i)) {
        if (predictions[i]['label_id'] === highlight) {
          ctx.strokeStyle = COLOR_HIGHLIGHT;
        } else {
          ctx.strokeStyle = COLOR_NORMAL;
        }
        paintBox(i, ctx, can);
      }
    }

    for (i = 0; i < predictions.length; i++) {
      if (displayBox(i)) {
        paintLabelText(i, ctx, can);
      }
    }
  }
}

// module function for painting bounding box on canvas
function paintBox(i, ctx, can) {
  ctx.beginPath();
  var corners = predictions[i]['detection_box'];
  var ymin = corners[0] * can.height;
  var xmin = corners[1] * can.width;
  var bheight = (corners[2] - corners[0]) * can.height;
  var bwidth = (corners[3] - corners[1]) * can.width;
  ctx.rect(xmin, ymin, bwidth, bheight);
  ctx.stroke();
}

// module function for painting label text on canvas
function paintLabelText(i, ctx, can) {
  var probability = predictions[i]['probability'];
  var box = predictions[i]['detection_box'];
  var y = box[0] * can.height;
  var x = box[1] * can.width;
  var bwidth = (box[3] - box[1]) * can.width;

  var label = predictions[i]['label'];
  var prob_txt = (probability * 100).toFixed(1) + '%';
  var text = label + ' : ' + prob_txt;

  var tWidth = ctx.measureText(text).width;
  if (tWidth > bwidth) {
    tWidth = ctx.measureText(label).width;
    text = label;
  }
  var tHeight = parseInt(ctx.font, 10) * 1.4;

  if (predictions[i]['label_id'] === highlight) {
    ctx.fillStyle = COLOR_HIGHLIGHT;
  } else {
    ctx.fillStyle = COLOR_NORMAL;
  }
  ctx.fillRect(x, y, tWidth + 3, tHeight);

  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(text, x + 1, y);
}

function populateLabelButtons() {
  var button_style_list = ['primary', 'secondary', 'success',
                           'danger', 'warning', 'info', 'dark'
                          ];
  var labelButtons_list = [];
  for (var i = 0; i < predictions.length; i++) {
    var label_id = predictions[i]['label_id'];
    if(labelButtons_list.includes(label_id)) {
      continue;
    } else {
    labelButtons_list.push(label_id);
    var btn = document.createElement("BUTTON");
    btn.setAttribute("id", 'label-icon-' + label_id);
    btn.setAttribute("class", "label-icon btn-xs btn btn-" +
                     button_style_list[Math.floor(Math.random() * button_style_list.length)]);
    btn.innerHTML = predictions[i]['label'];
    btn.onclick = function() {
      var this_id = $(this).attr('id').match(/\d+$/)[0];
      if ($(this).hasClass('hide-label')) {
        $(this).removeClass('hide-label');
        filter_list.splice(filter_list.indexOf(this_id), 1);
      } else {
        $(this).addClass('hide-label');
        filter_list.push(this_id);
      }
      paintCanvas();
    };
    btn.onmouseover = function() {
      highlight = $(this).attr('id').match(/\d+$/)[0];
      paintCanvas();
    };
    btn.onmouseleave = function() {
      highlight = '';
      paintCanvas();
    };
    document.getElementById("label-icons").appendChild(btn);
    }
  }
}

function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], {type: mimeString});
}

// Take uploaded image, display to canvas and run model
async function submitImageInput(event) {

  if ($('#file-input').val() !== '') {
    // Stop form from submitting normally
    event.preventDefault();

    clearCanvas();
    $('#image-display').html(''); // replaces previous img and canvas
    predictions = []; // remove any previous metadata
    updateLabelIcons(); // reset label icons

    // Create form data
    var form = await event.target;
    var file = await form[0].files[0];

    var data = await new FormData();
    var img = await document.createElement("img");
    var canvas = await document.createElement("canvas");

    var reader = await new FileReader();
    // Set the image once loaded into file reader
    reader.onload = async function(e) {

      img.src = await e.target.result;
      var ctx = await canvas.getContext("2d");
      const y = await ctx.drawImage(img, 0, 0);

      var MAX_WIDTH = 800;
      var MAX_HEIGHT = 800;
      var width = img.width;
      var height = img.height;

      if (width >= height) {
          if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
          }
      } else {
          if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
          }
      }
      canvas.width = width;
      canvas.height = height;
      var ctx = await canvas.getContext("2d");
      const k = await ctx.drawImage(img, 0, 0, width, height);

      var img_dataUrl = await canvas.toDataURL(file.type);
      var img_html = '<img id="user-image" class="shadow p-1 mb-3 bg-white" src="' 
        + img_dataUrl + '" />' + '<canvas id="image-canvas"></canvas>';
      $('#image-display').html(img_html); // replaces previous img and canvas

      var resized_img_blob = await dataURItoBlob(img_dataUrl);
      data.append('image', resized_img_blob);
      data.append('threshold', 0);
      sendImage(data);
       
  }
  const x = await reader.readAsDataURL(file);
  }
}

// Send image to model endpoint
function sendImage(data) {
  $('#file-submit').text('Detecting...');
  $('#file-submit').prop('disabled', true);

  // Perform file upload
  $.ajax({
    url: '/model/predict',
    method: 'post',
    processData: false,
    contentType: false,
    data: data,
    dataType: 'json',
    success: function(data) {
      predictions = data['predictions'];
      populateLabelButtons();
      paintCanvas();
      try {
        var quota = document.getElementById('quota').innerText;
        document.getElementById('quota').innerText = Math.max(0, parseInt(quota)-1);
      }
      catch(err) {

      }
      if (predictions.length === 0) {
        alert('No Food Objects Detected');
      }
    },
    error: function(jqXHR, status, error) {
      alert('Object Detection Failed: ' + jqXHR.responseText);
    },
    complete: function() {
      $('#file-submit').text('Submit');
      $('#file-submit').prop('disabled', false);
      $('#file-input').val('');
    },
  });
}

// Run or bind functions on page load
$(function() {
  // Update canvas when window resizes
  $(window).resize(function(){
    paintCanvas();
  });

  // Image upload form submit functionality
  $('#file-upload').on('submit', submitImageInput);

  // Update threshold value functionality
  $('#threshold-range').on('input', function() {
    $('#threshold-text span').html(this.value);
    threshold = $('#threshold-range').val() / 100;
    paintCanvas();
  });

});
