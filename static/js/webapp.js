/* eslint-env jquery */
/* eslint-env browser */

'use strict';

// canvas colors
const COLOR_NORMAL = '#00FF00'; // Lime
const COLOR_HIGHLIGHT = '#FFFFFF'; // White
const COLOR_TEXT = '#000000'; // Black

// global vars
var threshold = 0.5;
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

    //need to change this part when object detector endpoint is fixed
    try {
      var quota = document.getElementById('quota').innerText;
      document.getElementById('quota').innerText = Math.max(0, parseInt(quota)-1);
    }
    catch(err) {
 
    }

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

      if (width > height) {
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
      var img_html = '<img id="user-image" src="' + img_dataUrl + '" />'
        + '<canvas id="image-canvas"></canvas>';
      $('#image-display').html(img_html); // replaces previous img and canvas

      var resized_img_blob = await dataURItoBlob(img_dataUrl);
      data.append('image', resized_img_blob);
      data.append('threshold', 0);
      sendImage(data);
       
  }
  const x = await reader.readAsDataURL(file);
  }
}

// Enable the webcam
function runWebcam() {
  clearCanvas();
  var video_html = '<video playsinline autoplay></video>';
  $('#webcam-video').html(video_html);
  var video = document.querySelector('video');

  var constraints = {
    audio: false,
    video: { width: 9999, height: 9999 },
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    window.stream = stream; // make stream available to browser console
    video.srcObject = stream;
  }).catch(function(error) {
    console.log(error.message, error.name);
  });

  // Disable image upload
  $('#file-submit').prop('disabled', true);

  // Reset button
  $('#webcam-btn').removeClass('btn-primary').addClass('btn-danger shutter-btn')
    .text('Snap Picture').click(webcamImageInput).off('click', runWebcam);
}

// Output video frame to canvas and run model
function webcamImageInput() {
  var video = document.querySelector('video');
  $('#image-display').html('<canvas id="image-canvas"></canvas>');
  var canvas = document.querySelector('#image-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  var img = document.createElement('img');
  img.id = 'user-image';
  img.src = canvas.toDataURL();
  $('#image-display').prepend(img);

  window.stream.getVideoTracks()[0].stop();
  $('#webcam-video').empty();

  canvas.toBlob(function(blob) {
    var data = new FormData();
    data.append('image', blob);
    data.append('threshold', 0);
    sendImage(data);
  });

  paintCanvas();

  // Reset button
  $('#webcam-btn').removeClass('shutter-btn btn-danger').addClass('btn-primary')
    .text('New Picture?').off('click', webcamImageInput).click(runWebcam);

  // Re-enable image upload
  $('#file-submit').prop('disabled', false);
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
      paintCanvas();
      if (predictions.length === 0) {
        alert('No Objects Detected');
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

  // Enable webcam
  $('#webcam-btn').on('click', runWebcam);

  // Update threshold value functionality
  $('#threshold-range').on('input', function() {
    $('#threshold-text span').html(this.value);
    threshold = $('#threshold-range').val() / 100;
    paintCanvas();
  });

  // Populate the label icons on page load
  $.get('/model/labels', function(result) {
    $.each(result['labels'], function(i, label) {
      $('#label-icons').append($('<img>', {
        class: 'label-icon',
        id: 'label-icon-' + label.id,
        title: label.name,
        src: '/img/cocoicons/' + label.id + '.jpg',
      }));
    });

    // Add an "onClick" for each icon
    $('.label-icon').on('click', function() {
      var this_id = $(this).attr('id').match(/\d+$/)[0];
      if ($(this).hasClass('hide-label')) {
        $(this).removeClass('hide-label');
        filter_list.splice(filter_list.indexOf(this_id), 1);
      } else {
        $(this).addClass('hide-label');
        filter_list.push(this_id);
      }
      paintCanvas();
    });

    // Add mouse over for each icon
    $('.label-icon').hover(function() {
      highlight = $(this).attr('id').match(/\d+$/)[0];
      paintCanvas();
    }, function() {
      highlight = '';
      paintCanvas();
    });
  });
});
