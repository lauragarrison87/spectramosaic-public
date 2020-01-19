var loaded_header = null;
var loaded_data = [];
//var loaded_data_raw = null;


// callback function when the data is loaded
function csvDataFileLoaded(evt, csv_results_file, patient_name, voxel_id, png_file) {

    var data_text = evt.target.result;

    // skip the file before column names (should always start with "PPMScale")
    data_text = data_text.slice(data_text.indexOf("PPMScale"));

    var parsed = d3.csvParse(data_text, function(d) {
        return d;
    });

    // initialize table columns
    var data_table = {};
    parsed.columns.forEach(function(column) {
        data_table[column] = [];
    });

    // copy the data into the table, convert to float
    parsed.forEach(function(row) {
        parsed.columns.forEach(function(column) {
            data_table[column].push(parseFloat(row[column]));
        });
    });

    // preprocessing -- stretch to 1024 samples (interpolate)

    data_table = preprocessLoadedData(data_table);

    //	Load the Results file and PNG
    csv_results_file.data.file(function(data_file) {

        var fileReader_data = new FileReader();
        fileReader_data.onloadend = function(evt) {
            csvResultsFileLoaded(evt, png_file, patient_name, voxel_id, data_table);
        };

        fileReader_data.readAsText(data_file);
    });

}

function csvResultsFileLoaded(evt, png_file, patient_name, voxel_id, data_table) {

    var data_text = evt.target.result;

    //	Signal amplitudes data	
    var data_sig_amp = data_text.slice(data_text.indexOf("Row"), data_text.indexOf("CRLBs") - 1);
    var parsed_sig_amp = d3.csvParse(data_sig_amp, function(d) {
        return d;
    });

    //	Standard deviations	
    var data_stdev = data_text.slice(data_text.indexOf("Row", data_text.indexOf("CRLBs")), data_text.indexOf("Fit diagnostics") - 1);
    var parsed_stdev = d3.csvParse(data_stdev, function(d) {
        return d;
    });

    //	Merge with data from "fits" file -- create a *_results property which will contain the amplitude and st. deviation and CRLB percentage
    parsed_sig_amp.columns.forEach(function(column) {

        // skip "row", "col" and "slice" props
        if (column == "Row" || column == "Col" || column == "Slice") return;

        var con = parseFloat(parsed_sig_amp[0][column]);
        var stdev = parseFloat(parsed_stdev[0][column]);

        data_table[column + "_results"] = {
            concentration: con,
            std_deviation: stdev,
            CRLB_percent: (stdev / con) * 100
        };
    });

    // load the PNG image 	
    png_file.data.file(function(image_file) {
        var fileReader_img = new FileReader();
        fileReader_img.onloadend = function(evt) {
            pngLocationImageLoaded(evt, patient_name, voxel_id, data_table);
        };

        fileReader_img.readAsBinaryString(image_file);
    });
}

function csvHeaderFileLoaded(evt) {
    var data_text = evt.target.result;

    var dsv = d3.dsvFormat(";");

    // parse the data
    var parsed = dsv.parse(data_text);

    loaded_header = parsed;
}

function pngLocationImageLoaded(evt, patient_name, voxel_id, data_table) {
    var image_bytes = evt.target.result;

    var png_reader = new PNGReader(image_bytes);

    png_reader.parse(function(err, png) {
        if (err) throw err;

        // create a p5 image object out of the png

        var p5_img = p5_view_L.createImage(png.getWidth(), png.getHeight());
        p5_img.loadPixels();

        for (var i = 0; i < p5_img.width; i++) {
            for (var j = 0; j < p5_img.height; j++) {
                var pixel = png.getPixel(i, j);
                p5_img.set(i, j, p5_view_L.color(pixel[0], pixel[1], pixel[2]));
            }
        }

        p5_img.updatePixels();

        loaded_data.push({ patient: patient_name, voxel: voxel_id, data: data_table, image: p5_img });

        console.log("Loaded " + voxel_id + ": progress " + Math.floor((loaded_data.length / loaded_voxel_count) * 100));

        finishLoading(); // check if all the data have been loaded
    });
}