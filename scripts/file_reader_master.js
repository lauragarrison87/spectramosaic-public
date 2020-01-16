// Handle drag and drop operations

var loadingData = false;
var loaded_voxel_count = 0;

var baseline_value = 0;

// file input - CSV
function handleFileSelect(evt) {

    evt.stopPropagation();
    evt.preventDefault();

    if (loadingData) return;

    evt.dataTransfer = evt.originalEvent.dataTransfer;

    var files = evt.dataTransfer.items;
    var foundFiles = [];
    loaded_data = [];
    loaded_header = null;
    loadingData = true;
    p5_view_L.updateScene();

    // traverse all folders, create hierarchy: all data -> patient -> voxels

    for (var i = 0; i < files.length; i++) {
        var file = files[i].webkitGetAsEntry();
        foundFiles.push(readFolder(file, ""));
    }

    // read the data -- for some reason it needs a little time otherwise it doesn't find the header... I should look into that later
    setTimeout(function() {
        readData(foundFiles);
    }, 100);

    //finishLoading(new_data_length);
}

function readFolder(item, parent) {
    var result = null;

    if (item.isDirectory) {

        result = { parentDir: parent, name: item.name, isDirectory: true, isFile: false, contents: [] }

        var dirReader = item.createReader();

        dirReader.readEntries(function(entries) {
            entries.forEach(function(entry) {
                result.contents.push(readFolder(entry, item.name));
            });
        });

    } else if (item.isFile) {

        result = { parentDir: parent, name: item.name, isDirectory: false, isFile: true, data: item }
    }

    return result;
}

function readData(foundFiles) {
    var headerFile;

    if (foundFiles.length == 1) {
        headerFile = foundFiles[0].contents.find(function(elem) {
            return (elem.isFile && elem.name.includes("header") && elem.name.endsWith(".csv"));
        });
    } else if (foundFiles.length > 1) {
        headerFile = foundFiles.find(function(elem) {
            return (elem.isFile && elem.name.includes("header") && elem.name.endsWith(".csv"));
        });
    }

    if (headerFile) {
        headerFile = headerFile.data.file(function(header) {
            var fileReader_header = new FileReader();
            fileReader_header.onloadend = csvHeaderFileLoaded;
            fileReader_header.readAsText(header);
            readVoxels(foundFiles);
        });

    } else {
        alert("Header file not found!");
        return;
    }
}

function readVoxels(foundFiles) {

    // wait until the header is read
    if (!loaded_header) {
        setTimeout(function() {
            readVoxels(foundFiles);
        }, 10);
        return;
    }

    // see how many voxels are to be loaded
    loaded_voxel_count = 0;

    if (foundFiles.length == 1) {
        foundFiles[0].contents.forEach(function(patient) {
            if (patient.isFile) return;

            patient.contents.forEach(function(voxel) {
                if (voxel.isFile) return;

                loaded_voxel_count++;
            });
        });

    } else if (foundFiles.length > 1) {

        foundFiles.forEach(function(patient) {
            if (patient.isFile) return;

            patient.contents.forEach(function(voxel) {
                if (voxel.isFile) return;

                loaded_voxel_count++;
            });
        });
    }

    // process patients

    if (foundFiles.length == 1) {
        foundFiles[0].contents.forEach(function(patient) {
            if (patient.isFile) return;

            patient.contents.forEach(function(voxel) {
                if (voxel.isFile) return;

                readVoxel(patient.name, voxel.name, voxel.contents);
            });
        });

    } else if (foundFiles.length > 1) {

        foundFiles.forEach(function(patient) {
            if (patient.isFile) return;

            patient.contents.forEach(function(voxel) {
                if (voxel.isFile) return;

                readVoxel(patient.name, voxel.name, voxel.contents);
            });
        });
    }
}

function readVoxel(patient_name, voxel_id, data_files) {

    var csv_fits_file = data_files.find(function(elem) {
        return (elem.isFile && elem.name.startsWith(voxel_id) && elem.name.endsWith("fits.csv"));
    });

    var csv_results_file = data_files.find(function(elem) {
        return (elem.isFile && elem.name.startsWith(voxel_id) && elem.name.endsWith("results.csv"));
    });

    var png_file = data_files.find(function(elem) {
        return (elem.isFile && elem.name.startsWith(voxel_id) && elem.name.endsWith("ax.png"));
    });

    if (!csv_fits_file) {
        alert("Voxel " + voxel_id + ": CSV fits file not found.");
        return;
    }

    if (!csv_results_file) {
        alert("Voxel " + voxel_id + ": CSV results file not found.");
        return;
    }

    if (!png_file) {
        alert("Voxel " + voxel_id + ": PNG file not found.");
        return;
    }

    csv_fits_file.data.file(function(data_file) {

        var fileReader_data = new FileReader();
        fileReader_data.onloadend = function(evt) {
            csvDataFileLoaded(evt, csv_results_file, patient_name, voxel_id, png_file);
        };
        var loaded_filename = data_file.name.slice(0, -4);
        console.log("Loading: " + loaded_filename);
        fileReader_data.readAsText(data_file);
    });

    p5_view_L.updateScene(); // show loading text
}


// checks if all the data have been loaded - if so, stores and normalizes the data
function finishLoading() {
    if (loaded_data.length < loaded_voxel_count) {
        return;
    }

    loaded_data.forEach(function(vox) {
        var header_idx = loaded_header.findIndex(function(row) {
            return (row['Voxel ID'] == vox.voxel && row['Patient'] == vox.patient);
        });

        if (header_idx == -1) { // header info not found
            alert("Header information for voxel " + vox.voxel + ", patient " + vox.patient + " not found.");
            return;
        }

        var state_no = loaded_header[header_idx]['State'] == "resting" ? 0 : 1;

        addVoxel(vox.patient.replace("_", "-"), // patient name
            loaded_header[header_idx]['location'].replace("_", "-"), // voxel location
            vox.voxel.replace("_", "-"), // voxel ID
            vox.data, // voxel data
            vox.image, // PNG with the location
            state_no, // state
            loaded_header[header_idx]['Time'].replace("_", "-"), // timepoint 		
            loaded_header[header_idx]['Gender'].replace("_", "-"), // gender
            loaded_header[header_idx]['Age'].replace("_", "-"), // age	
            loaded_header[header_idx]['TE'].replace("_", "-")); // echo time
    });

    normalizeData();

    console.log("Data loaded");
    loadingData = false;
    p5_view_L.updateScene();
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer = evt.originalEvent.dataTransfer;
    evt.dataTransfer.dropEffect = 'copy';
}

$("#drop_zone").on({
    dragenter: function(evt) {
        evt.preventDefault();
    },
    dragleave: function(evt) {
        evt.preventDefault();
    },
    dragover: handleDragOver,
    drop: handleFileSelect
});