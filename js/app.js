'use strict';

var app = (function() {

    var BYTES_PER_KILOBYTE = 1024;
    var BYTES_PER_MEGABYTE = 1048576;
    var BYTES_PER_GIGABYTE = 1073741824;

    var CONTENT_LIST_ID = 'content-list';
    var HEADER_INFO_ID = 'header-info';
    var ACTION_HEADER_ID = 'action-header';
    var ACTION_FORM_ID = 'action-form';
    var MENU_ID = 'menu';
    var STORAGE_FORM_ID = 'storage-form';
    var STORAGE_MENU_ID = 'storage-menu';

    var availableStorages;
    var currentStorage;
    var currentDir;
    var currentFile;

    function init() {
        availableStorages = navigator.getDeviceStorages('sdcard');
        currentStorage = availableStorages[0];

        var contentList = document.getElementById(CONTENT_LIST_ID);
        contentList.addEventListener('click', _listHandler);

        var menuButton = document.getElementById(MENU_ID);
        menuButton.addEventListener('click', _menuHandler);

        var returnFalse = function() {
            return false;
        };

        document.getElementById(ACTION_FORM_ID).onsubmit = returnFalse;
        document.getElementById(STORAGE_FORM_ID).onsubmit = returnFalse;
    }

    function _menuHandler(e) {
        // Loop through every device storage
        var menu = $('#' + STORAGE_MENU_ID);
        menu.text('');
        for (var i = 0; i < availableStorages.length; i++) {
            var element =
                $('<button>', {'data-id': availableStorages[i].storageName, text: availableStorages[i].storageName});
            menu.append(element);
        }
        var cancelElement = $('<button>', {text: 'Cancel'});
        menu.append(cancelElement);
        $('#' + STORAGE_FORM_ID).on('click', _selectStorage).show();
    }

    function _selectStorage(e) {
        $('#' + STORAGE_FORM_ID).unbind('click').hide();
        var targetId = e.target.dataset.id;
        if (targetId) {
            for (var i = 0; i < availableStorages.length; i++) {
                if (targetId === availableStorages[i].storageName) {
                    currentStorage = availableStorages[i];
                    printDirectory("");
                    break;
                }
            }
        }
    }

    function _listHandler(e) {
        var target = e.target;

        var liElement = target.parentNode;
        if (liElement) {
            var id = liElement.dataset.id;
            if (id) {
                _selectAction(id);
            }
        }
    }

    function _selectAction(fileName) {
        currentFile = fileName; // NICE: A better way to pass the file name
        $('#' + ACTION_HEADER_ID).text('Action for ' + fileName);
        $('#' + ACTION_FORM_ID).on('click', _doAction).show();
    }

    function _doAction(e) {
        $('#' + ACTION_FORM_ID).unbind('click').hide();
        var targetNode = e.target.nodeName.toLowerCase();
        if (targetNode === 'button') {
            switch(e.target.id) {
                case 'open':
                    _openFile(currentFile);
                    break;
                case 'share':
                    _shareFile(currentFile);
                    break;
                case 'delete':
                    _deleteFile(currentFile);
                    break;
                default:
                    // Cancel
            }
        }
    }

    function _openFile(fileName) {
        console.log('Will try to open %s', fileName);
        var request = currentStorage.get(fileName);

        request.onsuccess = function () {
            var file = this.result;

            var activity = new MozActivity({
                name: 'open',
                data: {
                    type: file.type,
                    blob: file,
                    filename: file.name
                }
            });

            activity.onsuccess = function() {
                console.log('File %s successfully opened', file.name);
            };

            activity.onerror = function() {
                console.error('Unable to open the file: ', this.error);
            };
        };

        request.onerror = function () {
            console.error('Unable to get the file: ', this.error);
        };
    }

    function _shareFile(fileName) {
        console.log('Will try to share %s', fileName);
        var request = currentStorage.get(fileName);

        request.onsuccess = function () {
            var file = this.result;

            var activity = new MozActivity({
                name: 'share',
                data: {
                    blobs: [file],
                    filenames: [file.name]
                }
            });

            activity.onsuccess = function() {
                console.log('File %s successfully shared', file.name);
            };

            activity.onerror = function() {
                console.error('Unable to share the file: ', this.error);
            };
        };

        request.onerror = function () {
            console.error('Unable to get the file: ', this.error);
        };
    }

    function _deleteFile(fileName) {
        console.log('Will try to delete %s', fileName);
        var request = currentStorage.delete(fileName);

        request.onsuccess = function () {
            console.log('File %s successfully deleted', fileName);
            printDirectory(currentDir);
        };

        request.onerror = function () {
            console.error('Unable to delete the file: ', this.error);
            alert('The file ' + fileName + ' could not be deleted');
        };
    }

    function getUsedSpace() {
        var request = currentStorage.usedSpace();

        request.onsuccess = function () {
            // The result is expressed in bytes, lets turn it into _MEGABYTEs
            var size = _printFileSize(request.result);
            var message = '(' + size + ' used)';

            $('#' + HEADER_INFO_ID).text(message);
            console.log('The space used is ' + size);
        };

        request.onerror = function () {
            $('#' + HEADER_INFO_ID).text('Error');
            console.warn('Unable to get the used space: ' + this.error.name);
        };
    }

    function printDirectory(root) {
        var container = $('#' + CONTENT_LIST_ID);
        container.text(''); // NICE: Better way to delete element

        currentDir = root;

        console.log("Will print directory '%s' from storage '%s'", root, currentStorage.storageName);

        var cursor = currentStorage.enumerate(currentDir);

        cursor.onsuccess = function () {
            // Once we found a file we check if there are other results
            // Then we move to the next result, which calls the cursor
            // success possibly with the next file as result.
            if (!this.done) {
                var file = this.result;
                console.log("Found file %s of type '%s'", file.name, file.type);

                _printDirectoryElement(container, file);

                this.continue();
            }
        };

        cursor.onerror = function () {
            $('#' + containerId).text('Error');
            console.warn('Unable to get sd card cursor: ' + this.error.name);
        };
    }

    function _printDirectoryElement(container, element) {
        var a =
            $('<a>',{href: '#'}).append(
                    $('<p>', {text: element.name})
                ).append(
                    $('<p>', {text: _printFileDescription(element)})
                );
        var li = $('<li>', {'data-id': element.name});
        var icon = _printIcon(element);
        if (icon) {
            li.append(icon);
        }
        li.append(a);
        container.append(li);
    }

    function _printIcon(file) {
        var fileExtension = _getFileExtension(file.name);
        switch (fileExtension) {
            case 'doc':
            case 'pdf':
                return $('<aside>', {class: 'pack-end'}).append(
                    $('<img>', {alt: 'placeholder', src: 'img/' + fileExtension + '_16.png'})
                );
            default:
                return false;
        }
    }

    function _printFileDescription(file) {
        return _printFileType(file) + ' - ' + _printFileSize(file.size);
    }

    function _printFileType(file) {
        switch(_getFileExtension(file.name)) {
            case 'txt':
                return 'Text document';
            case 'doc':
                return 'Word document';
            case 'pdf':
                return 'PDF file';
            default:
                return 'File'
        }
    }

    function _printFileSize(size) {
        if (size < BYTES_PER_KILOBYTE) {
            return size + ' bytes';
        } else if (size < BYTES_PER_MEGABYTE) {
            return (size / BYTES_PER_KILOBYTE).toFixed(1) + ' KB';
        } else if (size < BYTES_PER_GIGABYTE) {
            return (size / BYTES_PER_MEGABYTE).toFixed(1) + ' MB';
        } else {
            return (size / BYTES_PER_GIGABYTE).toFixed(1) + ' GB';
        }
    }

    function _getFileExtension(filename) {
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    return {
        init: init,
        getUsedSpace: getUsedSpace,
        printDirectory: printDirectory
    }
})();
