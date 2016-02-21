/*
 Описалово

 Local TODO:
 Одна функция загрузки документов на загрузку и обновление,
 Для просмотра версий документов можно создать отдельный объект

 Global TODO:
 + Быстрый переход по истории/навигации,
 + Массовая загрузка
 + Массовая выгрузка zip,
 + Рекурсивное удаления не пустых папок,
 Сделать предыдущую версию как последнюю+1,
 +- Пренудительное скачивание, ? Чё-то не понятно, надо обсудить
 + Добавление кастомных аттрибутов,
 Динамическая сортировка по атрибутам + кастомные атрибуты,
 формат даты как настройка
 */
;
(function ($, undefined) {
    'use strict';

    var ECMBrowser = function (rootElement, initParameters) {
        this.root = rootElement;
        this.bpmthis = initParameters;

        var $body = $('body');

        if (!$body.hasClass('container-fluid')) {
            $body.addClass('container-fluid')
        }

        this.init();
    };

    ECMBrowser.prototype.init = function () {
        this.history = [];
        this.currentPage = null;
        this.currentNode = null;
        this.selectedElement = null;
        this.tempFile = null;
        this.folderExportServlet = this.bpmthis.context.options.folderExportServlet ? this.bpmthis.context.options.folderExportServlet.get("value") : null;

        this.tempData = null;

        this.filter = function (e) {
            return e;
        };

        $(this.root).html('<p><img src="/teamworks/images/common/loading.gif">&nbsp;' + i18n().loading + '&nbsp;&hellip;</p>');
        //$(this.root).html('<p><img src="' + com_ibm_bpm_coach.getManagedAssetUrl("loading.gif", com_ibm_bpm_coach.assetType_WEB) + '">&nbsp;' + i18n().loading + ' ...</p>');

        var rootId = this.bpmthis.context.binding ? this.bpmthis.context.binding.get("value").rootId : null;

//        console.log('/servlet/getTree' + '?id=' + rootId);

        $.ajax({
            //this.bpmthis.context.contextRootMap.federatedServer
            url: '/ecmservlet/getTree?id=' + rootId,
            //url: 'getTree.js',
            type: 'get',
            dataType: 'json',
            success: $.proxy(function (result, status, xhr) {
                console.log(result);
                console.log(status);
                console.log(xhr);

                $(this.root).html(template);

                this.setCurrentFolder(result);
                this.setActions();
                this.setFilter();

                this.createFolderModal();
                this.deleteFolderModal();

                this.uploadDocumentModal();
                this.deleteDocumentModal();
                this.updateDocumentModal();
                this.editDocumentModal();
            }, this),
            error: function (xhr, status, error) {
                alert("Ошибка обработки запроса!");
            }
        });
    };

    ECMBrowser.prototype.initPaging = function (perPage) {
        var all = 0;
        all += (this.currentNode.subfolders == null ? 0 : this.currentNode.subfolders.filter(this.filter).length);
        all += (this.currentNode.files == null ? 0 : this.currentNode.files.filter(this.filter).length);

        if (this.history.length > 0) {
            all++
        }

        var amount = Math.ceil(all / perPage);

        var gap = '<li><a>&hellip;</a></li>';
        var ecmpagination = $('.ecmpagination', this.root);

        ecmpagination.empty();
        // Main part
        if (amount > 1) {
            var start = $.proxy(function () {
                ecmpagination.append('<li data-page="0"><a href="#">1</a></li>');
                ecmpagination.append('<li data-page="1"><a href="#">2</a></li>');
                ecmpagination.append(gap);
            }, this);

            var end = $.proxy(function () {
                ecmpagination.append(gap);
                ecmpagination.append('<li data-page="' + (amount - 2) + '"><a href="#">' + (amount - 1) + '</a></li>');
                ecmpagination.append('<li data-page="' + (amount - 1) + '"><a href="#">' + amount + '</a></li>');
            }, this);

            ecmpagination.append('<li' + (this.currentPage != 0 ? ' data-page="prev"' : ' class="disabled"' ) + '><a href="#"><span>&laquo;</span></a></li>');

            if (amount > 8) {
                if (this.currentPage < 5) {
                    for (var i = 0; i < 6; i++) {
                        ecmpagination.append('<li' + (i == this.currentPage ? ' class="active"' : ' ') + 'data-page="' + i + '"><a href="#">' + (i + 1) + '</a></li>');
                    }

                    end();
                } else if (this.currentPage > 3 && this.currentPage < (amount - 5)) {
                    start();

                    for (var i = this.currentPage - 1; i < this.currentPage + 2; i++) {
                        ecmpagination.append('<li' + (i == this.currentPage ? ' class="active"' : ' ') + 'data-page="' + i + '"><a href="#">' + (i + 1) + '</a></li>');
                    }

                    end();
                } else {
                    start();

                    for (var i = amount - 6; i < amount; i++) {
                        ecmpagination.append('<li' + (i == this.currentPage ? ' class="active"' : ' ') + 'data-page="' + i + '"><a href="#">' + (i + 1) + '</a></li>');
                    }
                }
            } else {
                for (var i = 0; i < amount; i++) {
                    ecmpagination.append('<li' + (i == this.currentPage ? ' class="active"' : ' ') + 'data-page="' + i + '"><a href="#">' + (i + 1) + '</a></li>');
                }
            }

            ecmpagination.append('<li' + (amount > (this.currentPage + 1) ? ' data-page="next"' : ' class="disabled"' ) + '><a href="#"><span>&raquo;</span></a></li>');
            $('.ecmpagingdiv', this.root).show();
        } else {
            $('.ecmpagingdiv', this.root).hide();
        }

        ecmpagination.find('li[data-page]').on('click', $.proxy(function (e) {
            var page = $(e.currentTarget).data('page');
            if (page != this.currentPage) {
                this.setPage(page);
            }
        }, this));

        $('.ecmpage', this.root).html(i18n().page + " " + (this.currentPage + 1) + " " + i18n().of + " " + amount);
    };

    ECMBrowser.prototype.setPage = function (page) {
        if (typeof page === "number") {
            this.currentPage = page;
        } else if (typeof page === "string") {
            if (page == "prev") {
                this.currentPage--;
            } else if (page == "next") {
                this.currentPage++;
            }
        }

        var perPage = 10;

        this.initPaging(perPage);

        $('tr[data-row]', this.root).hide();

        for (var i = 0; i < perPage; i++) {
            var node = $(sprintf('tr[data-row=%s]', (this.currentPage * perPage + i)), this.root);
            node.show();
        }
    };

    ECMBrowser.prototype.setCurrentFolder = function (node) {
        this.currentNode = node;
        this.setCaption(node.name);

        var tbody = $('.ecmtable tbody', this.root);
        tbody.empty();

        var rowcount = 0;

        // Вверх по структуре
        if (this.history.length > 0) {
            tbody.append(sprintf('<tr class="ecm-row" data-row="%s" root><td colspan="3"><span class="glyphicon glyphicon-level-up"></span>&nbsp;..</td></tr>', rowcount));

            $('tr[root]', this.root).on('click', $.proxy(function (e) {
                this.setCurrentFolder(this.history.pop());
                this.setPage(0);
            }, this));

            rowcount++
        }

        $.each(typeof node.subfolders != 'undefined' ? node.subfolders.filter(this.filter).sort(sortByName) : [], $.proxy(function (i, element) {
            tbody.append(
                sprintf('<tr class="ecm-row"  data-id="%s" style="display:none" data-row="%s" data-row-folder="%s">', element.id, rowcount, i) +
                '<td class="ecm-column-0">' +
                '<span class="glyphicon glyphicon-folder-close"></span>&nbsp;' +
                element.name +
                '<div class="row-actions">' +
                '<span class="glyphicon glyphicon-cloud-download"></span>&nbsp;' +
                '<span class="glyphicon glyphicon-trash"></span>' +
                '</div></td><td>' +
                element.author + '</td><td>' +
                TWDateToString(element.modified) + '</td></tr>');

            var currentFolder = $(sprintf('tr[data-row-folder=%s]', i), this.root);

            currentFolder.find('td.ecm-column-0 span.glyphicon-cloud-download').on('click', $.proxy(function (e) {
                window.open(element.url);
            }, this));

            currentFolder.find('td.ecm-column-0 span.glyphicon-trash').on('click', $.proxy(function (e) {
                this.selectedElement = element;
                $("#deleteFolderModal").modal("show");
            }, this));

            currentFolder.find('td.ecm-column-0 span.glyphicon-folder-close').on('click', $.proxy(function (e) {
                this.history.push(node);
                this.setCurrentFolder(element);
            }, this));

            rowcount++;
        }, this));

        $.each(typeof node.files != 'undefined' ? node.files.filter(this.filter).sort(sortByName) : [], $.proxy(function (i, element) {
            tbody.append(
                sprintf('<tr class="ecm-row"  data-id="%s" style="display:none" data-row="%s" data-row-file="%s">', element.id, rowcount, i) +
                '<td class="ecm-column-0">' +
                '<span class="glyphicon glyphicon-file"></span>&nbsp;' +
                element.name +
                '<div class="row-actions">' +
                '<span class="glyphicon glyphicon-edit"></span>&nbsp;' +
                '<span class="glyphicon glyphicon-import"></span>&nbsp;' +
                '<span class="glyphicon glyphicon-list-alt"></span>&nbsp;' +
                '<span class="glyphicon glyphicon-trash"></span>' +
                '</div></td><td>' +
                element.author + '</td><td>' +
                TWDateToString(element.modified) + '</td></tr>');

            var currentFile = $(sprintf('tr[data-row-file=%s]', i), this.root);

            currentFile.find('td.ecm-column-0 span.glyphicon-edit').on('click', $.proxy(function (e) {
                this.selectedElement = element;
                $('.ecmeditdocumentmodal').modal('show');
            }, this));

            currentFile.find('td.ecm-column-0 span.glyphicon-import').on('click', $.proxy(function (e) {
                this.selectedElement = element;
                $('#updateDocumentModal').modal('show');
            }, this));

            currentFile.find('td.ecm-column-0 span.glyphicon-list-alt').on('click', $.proxy(function (e) {
                this.selectedElement = element;
                this.documentVersionsModal();
                $('#documentVersionsModal').modal('show');
            }, this));

            currentFile.find('td.ecm-column-0 span.glyphicon-trash').on('click', $.proxy(function (e) {
                this.selectedElement = element;
                $('#deleteDocumentModal').modal('show');
            }, this));

            currentFile.find('td.ecm-column-0 span.glyphicon-file').on('click', $.proxy(function (e) {
                window.open(element.url);
            }, this));

            rowcount++;
        }, this));

        this.setPage(0);
    };

    ECMBrowser.prototype.setFilter = function () {
        var cleanFunction = $.proxy(function (event) {
            this.filter = $.proxy(function (element) {
                return element;
            }, this);

            $(".ecmsearchfield", this.root).val('');

            this.currentPage = 0;
            this.refresh();
        }, this);

        var eventHandler = $.proxy(function (event) {
            if ((event.type == 'keypress' && event.keyCode == 13) || event.type == 'click') {
                this.filter = $.proxy(function (element) {
                    if (element.name === undefined) {
                        return undefined;
                    } else if (element.name.toLowerCase().includes($(".ecmsearchfield", this.root).val().toLowerCase())) {
                        return element;
                    }

                }, this);

                this.currentPage = 0;
                this.refresh();
            } else if (event.type == 'keypress' && event.keyCode == 27) {
                cleanFunction();
            }
        }, this);

        $('.ecmsearchbutton', this.root).on('click', eventHandler);
        $('.ecmsearchfield', this.root).on('keypress', eventHandler);
        $('.ecmsearchclean', this.root).on('click', cleanFunction);
    };

    ECMBrowser.prototype.setActions = function () {
        $('.ecmactions', this.root).html('<div class="row">' +
        '<div class="col-sm-7"><div role="group" class="btn-group">' +
        '<button class="btn btn-default ecmbtn-createfolder" type="button">' +
        '<span class="glyphicon glyphicon-plus"></span>&nbsp;' + i18n().createFolder + '</button>' +

        '<button class="btn btn-default ecmbtn-uploaddocument" type="button">' +
        '<span class="glyphicon glyphicon-plus"></span>&nbsp;' + i18n().uploadDocument + '</button>' +

        '<button class="btn btn-default ecmbtn-sort" type="button">' +
        '<span class="glyphicon glyphicon-sort"></span>&nbsp;' + i18n().sorting + '</button>' +

        '<button class="btn btn-default ecmbtn-refresh" type="button">' +
        '<span class="glyphicon glyphicon-refresh"></span>&nbsp;' + i18n().refresh + '</button>' +

        '</div></div><div class="col-sm-5"><div class="input-group">' +
        '<div class="ecmsearchbutton input-group-addon"><i class="glyphicon glyphicon-search"></i></div>' +
        '<input type="text" class="ecmsearchfield form-control" placeholder="' + i18n().filter + '">' +
        '<div class="ecmsearchclean input-group-addon"><i class="glyphicon glyphicon-trash"></i>' +
        '</div></div></div>');

        $('.ecmbtn-sort', this.root).on('click', $.proxy(function (e) {
            $('.ecmsortingmodal').modal('show');
        }, this));

        $('.ecmbtn-refresh', this.root).on('click', $.proxy(function (e) {
            this.init();
        }, this));

        $('.ecmbtn-createfolder', this.root).on('click', $.proxy(function (e) {
            $('.newfoldermodal').modal('show');
        }, this));

        $('.ecmbtn-uploaddocument', this.root).on('click', $.proxy(function (e) {
            $('.newdocumentmodal', this.root).modal('show');
        }, this));
    };

    ECMBrowser.prototype.createFolderModal = function () {
        var newFolderModal = $('.newfoldermodal', this.root);
        var newFolderNameFormGroup = newFolderModal.find('.newfoldername-form-group');
        var newFolderNameInput = newFolderNameFormGroup.find('input');
        var newFolderButton = newFolderModal.find('button.btn-create');

        newFolderModal.on('hidden.bs.modal', function (e) {
            newFolderNameFormGroup.removeClass('has-error');
            newFolderNameInput.val('');
        });

        var createFolder = $.proxy(function (e) {
            if ((e.type == 'keypress' && e.keyCode == 13) || e.type == 'click') {
                newFolderNameFormGroup.removeClass('has-error');
                var hasError = false;

                //&|\?

                if (newFolderNameInput.val() == '') {
                    newFolderNameFormGroup.addClass('has-error');
                    hasError = true;
                }

                if (!hasError) {
                    newFolderButton.attr('disabled', 'disabled');
                    $.ajax({
                        //this.bpmthis.context.contextRootMap.federatedServer
                        url: '/ecmservlet/createFolder?' + 'parentFolderId=' + this.currentNode.id + '&newFolderName=' + newFolderNameInput.val(),
                        type: 'get',
                        dataType: 'json',
                        success: $.proxy(function (result, status, xhr) {
                            console.log(result);
                            console.log(status);
                            console.log(xhr);

                            newFolderModal.modal('hide');
                            newFolderNameInput.val('');

                            if (typeof this.currentNode.subfolders == 'undefined') {
                                this.currentNode.subfolders = [];
                            }

                            this.currentNode.subfolders.push(result);
                            newFolderButton.removeAttr('disabled');
                            this.refresh();
                        }, this),
                        error: function (xhr, status, error) {
                            alert("Ошибка обработки запроса!");
                        }
                    });
                }
            }
        }, this);

        newFolderButton.on('click', createFolder);
        newFolderNameInput.on('keypress', createFolder);
    };

    ECMBrowser.prototype.uploadDocumentModal = function () {
        var newDocumentModal = $('.newdocumentmodal', this.root);

        //var newDocumentForm = newDocumentModal.find('form');

        var newDocumentButton = newDocumentModal.find('button[type="submit"]');

        var newDocumentFormGroup = newDocumentModal.find('.newdocument-form-group');
        var newDocumentTable = newDocumentFormGroup.find('.filetable');
        var newDocumentDiv = newDocumentFormGroup.find('.ecmdnd');
        var newDocumentFileChooser = newDocumentFormGroup.find('.filechooser');
        var newDocumentProgress = newDocumentFormGroup.find('.ecmprogress');
        var newDocumentProgressLine = newDocumentProgress.find('.progress-bar');

        $('form', newDocumentModal).submit($.proxy(function (event) {
            event.preventDefault();

            newDocumentFormGroup.removeClass('has-error');
            var hasError = false;

            if (this.tempData == null) {
                newDocumentFormGroup.addClass('has-error');
                hasError = true;
            }

            if (!hasError) {
                newDocumentButton.attr('disabled', 'disabled');
                this.tempData.append("param_folder_id", this.currentNode.id);

                $.ajax({
                    url: '/ecmservlet/upload',
                    data: this.tempData,
                    type: 'post',
                    processData: false,
                    contentType: false,
                    xhr: function () {
                        var myXhr = $.ajaxSettings.xhr();

                        myXhr.upload.onprogress = function (evt) {
                            var prgrs = evt.loaded / evt.total * 100;

                            newDocumentProgressLine.css('width', Math.round(prgrs) + '%');
                        };
                        myXhr.upload.onloadstart = function () {
                            newDocumentProgress.show();
                        };
                        myXhr.upload.onloadend = function () {
                            newDocumentProgress.hide();
                            newDocumentProgressLine.css('width', '0%');
                        };

                        return myXhr;
                    },
                    success: $.proxy(function (result, status, xhr) {
                        console.log(result);

                        $.each(result, $.proxy(function (i, file) {
                            this.currentNode.files.push(file);
                        }, this));

                        newDocumentModal.modal('hide');
                        newDocumentButton.removeAttr('disabled');

                        this.tempData = null;

                        this.refresh();
                    }, this),
                    error: function (xhr, status, error) {
                        alert("Ошибка обработки запроса!");
                        newDocumentButton.removeAttr('disabled');
                    }
                });
            }
        }, this));

        newDocumentModal.on('hidden.bs.modal', $.proxy(function (e) {
            newDocumentFormGroup.removeClass('has-error');
            newDocumentTable.find('tbody').empty();
            this.tempData = null;
        }, this));

        newDocumentDiv.on('dragover', $.proxy(function (e) {
            e.stopPropagation();
            e.preventDefault();
            newDocumentDiv.addClass('ecmdnd-over');
        }, this));

        var newDocumentFileTableRefresh = $.proxy(function () {
            newDocumentTable.find('tbody').empty();

            var iter = this.tempData.values();

            var item;
            var length = 0;
            while (item = iter.next()) {
                if (item.done == true) break;
                console.log(item.value);

                var file = item.value;

                newDocumentTable.append('<tr><th scope="row">' + ++length + '</th><td>' + file.name + '</td><td>' + filesize(file.size) + '</td><td>' + file.type + '</td><td>' +
                '<button data-item="' + file.name + '" type="button" class="btn btn-default btn-delete-item"><span class="glyphicon glyphicon-remove"></span></button>' +
                '</td></tr>');

                var deleteItem = newDocumentTable.find('.btn-delete-item');
                deleteItem.off('click');
                deleteItem.on('click', $.proxy(function (e) {
                    console.log(e);
                    var item = $(e.currentTarget).data("item");
 		    console.log(item);
                    this.tempData.delete(item);

                    newDocumentFileTableRefresh();
                }, this));
            }
        }, this);


        newDocumentDiv.on('drop', $.proxy(function (e) {
            e.preventDefault();
            var files = e.originalEvent.dataTransfer.files;

            this.tempData = addToData(this.tempData, files);
            newDocumentFileTableRefresh();

            newDocumentDiv.removeClass('ecmdnd-over');
        }, this));

        newDocumentDiv.on('dragleave', $.proxy(function (e) {
            e.stopPropagation();
            e.preventDefault();
            newDocumentDiv.removeClass('ecmdnd-over');
        }, this));

        newDocumentDiv.on('click', $.proxy(function (e) {
            e.stopPropagation();
            e.preventDefault();
            $('.filechooser', newDocumentModal).trigger('click');
        }, this));

        newDocumentFileChooser.on('change', $.proxy(function (e) {
            var files = e.target.files;

            this.tempData = addToData(this.tempData, files);
            newDocumentFileTableRefresh();
        }, this));
    };

    ECMBrowser.prototype.deleteFolderModal = function () {
        var deleteFolderModal = $("#deleteFolderModal");
        var deleteFolderButton = deleteFolderModal.find("button.btn-delete");

        deleteFolderButton.on('click', $.proxy(function (e) {
            deleteFolderButton.attr("disabled", "disabled");

            $.ajax({
                url: '/ecmservlet/deleteFolder?' + 'folderId=' + this.selectedElement.id,
                type: 'get',
                dataType: 'json',
                success: $.proxy(function (result, status, xhr) {
                    console.log(result);
                    console.log(status);
                    console.log(xhr);

                    var removeElement = this.currentNode.subfolders.find($.proxy(function (e) {
                        return e.id === this.selectedElement.id;
                    }, this));

                    var index = this.currentNode.subfolders.indexOf(removeElement);

                    if (index > -1) {
                        this.currentNode.subfolders.splice(index, 1);
                    }

                    deleteFolderModal.modal("hide");

                    deleteFolderButton.removeAttr("disabled");

                    this.refresh();
                }, this),
                error: function (xhr, status, error) {
                    console.log(xhr);
                    console.log(status);
                    console.log(error);

                    deleteFolderButton.removeAttr("disabled");
                    alert("Ошибка обработки запроса!");
                }
            });
        }, this));
    };

    ECMBrowser.prototype.deleteDocumentModal = function () {
        var deleteDocumentModal = $("#deleteDocumentModal");

        var deleteDocumentButton = deleteDocumentModal.find("button.btn-delete");

        deleteDocumentButton.on('click', $.proxy(function (e) {
            deleteDocumentButton.attr("disabled", "disabled");

            var input = {documentId: this.selectedElement.id};

            var ajax = {
                params: JSON.stringify(input),
                load: $.proxy(function (data) {
                    var index = this.currentNode.files.indexOf(this.selectedElement);
                    if (index > -1) {
                        this.currentNode.files.splice(index, 1);
                    }

                    $("#deleteDocumentModal").modal("hide");

                    deleteDocumentButton.removeAttr("disabled");

                    this.refresh();
                }, this),
                error: function (data) {
                    console.log(data);
                    deleteDocumentButton.removeAttr("disabled");
                    alert("Ошибка обработки запроса!");
                }
            };

            this.bpmthis.context.options.deleteDocument(ajax);
        }, this));
    };

    ECMBrowser.prototype.documentVersionsModal = function () {
        var documentVersionsModal = $('#documentVersionsModal', this.root);
        var documentVersionsTable = documentVersionsModal.find('.versiontable');
        var documentVersionsTablePaging = $('.versionpagination', this.root);

        documentVersionsModal.on('hidden.bs.modal', function (e) {
            documentVersionsTable.empty();
        });

        var input = {documentId: this.selectedElement.id};

        var ajax = {
            params: JSON.stringify(input),
            load: $.proxy(function (data) {
                documentVersionsTable.empty();

                var versionTable = '<thead><tr>' +
                    '<th width="100%">' + i18n().name + '</th>' +
                    '<th>' + i18n().author + '</th>' +
                    '<th>' + i18n().version + '</th>' +
                    '<th>' + i18n().dateOfChange + '</th>' +
                    '</tr></thead><tbody></tbody>';

                documentVersionsTable.append(versionTable);
                var documentVersionsTableBody = documentVersionsTable.find('tbody');

                var perPage = 5;

                var setVerionPage = $.proxy(function (page) {
                    $('.versionrow', this.root).hide();
                    for (var i = page * perPage; i < (page * perPage + perPage); i++) {
                        $('.versionrow-' + i, this.root).show();
                    }

                    documentVersionsTablePaging.empty();
                    if (data.files.items.length >= perPage) {
                        var pages = Math.ceil(data.files.items.length / perPage);

                        for (var i = 0; i < pages; i++) {
                            documentVersionsTablePaging.append('<li' + (i == page ? ' class="active"' : '') + ' data-page="' + i + '"><a href="#">' + (i + 1) + '</a></li>');
                        }

                        documentVersionsTablePaging.show();

                        documentVersionsTablePaging.find("li[data-page]").on('click', $.proxy(function (e) {
                            var datapage = $(e.currentTarget).data("page");
                            if (datapage != data) {
                                setVerionPage(datapage);
                            }
                        }, this));
                    } else {
                        documentVersionsTablePaging.hide();
                    }
                }, this);

                $.each(data.files.items, $.proxy(function (i, element) {
                    var row = [];
                    row.push('<tr class="versionrow versionrow-' + i + '">',
                        '<td><a href="', element.contentURL, '" target="_blank">', element.name, '</td>',
                        '<td>', element.author, '</td>',
                        '<td>', element.version, '</td>',
                        '<td>', TWDateToString(element.modified), '</td>',
                        '</tr>');

                    documentVersionsTableBody.append(row.join(""));
                }, this));

                setVerionPage(0);
            }, this),
            error: function (data) {
                console.log(data);
                alert("Ошибка обработки запроса!");
            }
        };

        this.bpmthis.context.options.getDocumentVersions(ajax);
    };

    ECMBrowser.prototype.updateDocumentModal = function () {
        var updateDocumentModal = $("#updateDocumentModal");

        var updateDocumentForm = updateDocumentModal.find("form");

        var updateDocumentCommentFormGroup = updateDocumentModal.find(".updatedocumentcomment-form-group");
        var updateDocumentCommentTextarea = updateDocumentCommentFormGroup.find("textarea");

        var updateDocumentFileFormGroup = updateDocumentModal.find(".updatedocumentfile-form-group");
        var updateDocumentFileInput = updateDocumentFileFormGroup.find("input");

        var updateDocumentButton = updateDocumentModal.find("button.btn-update");

        updateDocumentForm.on("change", $.proxy(function (event) {
            var files = event.target.files;
            if (files) {
                var file = files[0];
                if (file) {
                    var reader = new FileReader();
                    reader.onload = $.proxy(function (e) {
                        var binary = '';
                        var bytes = new Uint8Array(e.target.result);
                        var length = bytes.byteLength;
                        for (var i = 0; i < length; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }

                        this.tempFile = {content: btoa(binary), type: file.type}
                    }, this);

                    reader.readAsArrayBuffer(file);
                }
            }
        }, this));

        updateDocumentModal.on("hidden.bs.modal", function (e) {
            updateDocumentCommentFormGroup.removeClass('has-error');
            updateDocumentFileFormGroup.removeClass('has-error');
            updateDocumentForm.trigger("reset");
        });

        updateDocumentButton.on('click', $.proxy(function (e) {
            updateDocumentCommentFormGroup.removeClass('has-error');
            updateDocumentFileFormGroup.removeClass('has-error');
            var hasError = false;

            if (updateDocumentCommentTextarea.val() == '') {
                updateDocumentCommentFormGroup.addClass('has-error');
                hasError = true;
            }
            if (updateDocumentFileInput.val() == '') {
                updateDocumentFileFormGroup.addClass('has-error');
                hasError = true;
            }

            if (!hasError) {
                updateDocumentButton.attr('disabled', 'disabled');

                var data = new FormData();
                data.append("param_comment", updateDocumentCommentTextarea.val());
                data.append("param_document_id", this.selectedElement.id);
                //data.append("file_new_version",this.selectedElement.id);

                var x = document.getElementById("fileContent");
                var txt = "";
                if ('files' in x) {
                    if (x.files.length == 0) {
                        txt = "Select one or more files.";
                    } else {
                        for (var i = 0; i < x.files.length; i++) {
                            txt += (i + 1) + ". file";
                            var file = x.files[i];
                            data.append("file_new_version", file);
                            if ('name' in file) {
                                txt += "name: " + file.name + "<br>";
                            }
                            if ('size' in file) {
                                txt += "size: " + file.size + " bytes <br>";
                            }
                        }
                    }
                }

                console.log(txt);

                $.ajax({
                    url: '/ecmservlet/update',
                    type: 'post',
                    data: data,
                    dataType: 'json',
                    processData: false,
                    contentType: false,
                    success: $.proxy(function (result, status, xhr) {
                        console.log(result);
                        console.log(status);
                        console.log(xhr);

                        updateDocumentModal.modal('hide');
                        updateDocumentForm.trigger('reset');
                        updateDocumentButton.removeAttr('disabled');

                        var index = this.currentNode.files.indexOf(this.selectedElement);
                        if (index > -1) {
                            this.currentNode.files.splice(index, 1);
                            this.currentNode.files.push(result);
                        }

                        this.tempFile = null;
                        this.refresh();
                    }, this),
                    error: function (xhr, status, error) {
                        updateDocumentButton.removeAttr('disabled');
                        alert("Ошибка обработки запроса!");
                    },
                    xhr: function () {
                        var myXhr = $.ajaxSettings.xhr();

                        myXhr.upload.onprogress = function (evt) {
                            var prgrs = evt.loaded / evt.total * 100;
                            console.log(prgrs);
                        };
                        myXhr.upload.onloadstart = function () {
                        };
                        myXhr.upload.onloadend = function () {
                        };

                        return myXhr;
                    }
                });
            }
        }, this));
    };

    ECMBrowser.prototype.editDocumentModal = function () {
        var editDocumentModal = $('.ecmeditdocumentmodal', this.root);

        var editDocumentModalAddButton = editDocumentModal.find('.btn-add');

        var editDocumentModalPropTable = editDocumentModal.find('.proptable');
        var editDocumentModalPropTableBody = editDocumentModalPropTable.find('tbody');

        var editDocumentModalEditButton = editDocumentModal.find('.btn-edit');

        var wireDeleteButton = function () {
            var editDocumentModalRemoveButton = editDocumentModal.find('button.btn-remove');

            editDocumentModalRemoveButton.off();
            editDocumentModalRemoveButton.on('click', function (e) {
                $(e.target.parentNode.parentNode).remove();
            });
        };

        editDocumentModalAddButton.on('click', $.proxy(function (e) {
            editDocumentModalPropTableBody.append('<tr><td class="prop-name"><input type="text" class="form-control"></td><td class="prop-value"><input type="text" class="form-control"></td><td><button type="button" class="btn btn-danger btn-remove"><span class="glyphicon glyphicon-minus"></span></button></td></tr>');

            wireDeleteButton();
        }, this));

        editDocumentModal.on('show.bs.modal', $.proxy(function (e) {
            $.each(this.selectedElement.properties, function (i, property) {
                if (property.name == 'IBM_BPM_Document_Properties') {
                    if (typeof property.value != 'undefined' && Array.isArray(property.value)) {

                        $.each(property.value, function (j, propertyRow) {
                            var nameValue = propertyRow.split(',');

                            editDocumentModalPropTableBody.append('<tr><td class="prop-name">' +
                            '<input type="text" class="form-control" value="' + nameValue[0] + '"></td><td class="prop-value">' +
                            '<input type="text" class="form-control" value="' + nameValue[1] + '"></td><td><button type="button" class="btn btn-danger btn-remove"><span class="glyphicon glyphicon-minus"></span></button></td></tr>');
                        });
                    }
                }
            });
            wireDeleteButton();
        }, this));

        editDocumentModal.on('hidden.bs.modal', function (e) {
            editDocumentModalPropTableBody.empty();
        });

        editDocumentModalEditButton.on('click', $.proxy(function (e) {
            editDocumentModalEditButton.attr('disabled', 'disabled');

            var properties = [];

            $.each(editDocumentModalPropTableBody.find('tr'), function (i, element) {
                var name = $(element).find('td.prop-name input').val();
                var value = $(element).find('td.prop-value input').val();

                properties.push({name: name, value: value});
            });

            var input = {
                documentId: this.selectedElement.id,
                properties: JSON.stringify(properties)
            };
            console.log(input);

            //var ajax = {
            //    params: JSON.stringify(input),
            //    load: $.proxy(function (data) {
            //        console.log(data);
            //        editDocumentModalEditButton.removeAttr('disabled');
            //        editDocumentModal.modal('hide');
            //
            //
            //        var index = this.currentNode.files.indexOf(this.selectedElement);
            //        if (index > -1) {
            //            this.currentNode.files.splice(index, 1);
            //            this.currentNode.files.push(data.file);
            //        }
            //
            //        this.refresh();
            //    }, this),
            //    error: $.proxy(function (data) {
            //        console.log(data);
            //        alert("Ошибка обработки запроса!");
            //        editDocumentModalEditButton.removeAttr('disabled');
            //        editDocumentModal.modal('hide');
            //    }, this)
            //};
            //
            //this.bpmthis.context.options.updateDocumentProperties(ajax);

            $.ajax({
                //this.bpmthis.context.contextRootMap.federatedServer
                url: '/ecmservlet/updateDocumentProperties',
                type: 'get',
                data: input,
                dataType: 'json',
                success: $.proxy(function (result, status, xhr) {
                    console.log(result);
                    console.log(status);
                    console.log(xhr);

                    editDocumentModalEditButton.removeAttr('disabled');
                }, this),
                error: function (xhr, status, error) {
                    alert("Ошибка обработки запроса!");
                    editDocumentModalEditButton.removeAttr('disabled');
                }
            });

        }, this));
    };

    ECMBrowser.prototype.change = function (e) {
        console.log(e);
    };

    ECMBrowser.prototype.refresh = function () {
        this.setCurrentFolder(this.currentNode);
        this.setPage(this.currentPage === undefined ? 0 : this.currentPage);
    };

    ECMBrowser.prototype.setCaption = function (name) {
        $('.ecmcaption', this.root).html('<h3 class="foldername">' + (name ? name : '') + '</h3>');

        var str = '<ol class="breadcrumb">';
        $('.ecmcaption', this.root).append();
        $.each(this.history, $.proxy(function (index, element) {
            str += '<li><a data-history="' + index + '" href="#">' + element.name + '</a></li>';
        }, this));

        str += '<li class="active">' + name + '</li>';
        str += '</ol>';

        $('.ecmcaption', this.root).append(str);

        $('a[data-history]').on('click', $.proxy(function (e) {
            var datahistory = $(e.currentTarget).data("history");
            this.history.splice(datahistory + 1, this.history.length - datahistory);
            this.setCurrentFolder(this.history.pop());
        }, this));

    };

    var i18n = function () {
        var locales = [];
        locales['en-US'] = locales['en'] = {
            name: "Name", author: "Author", dateOfChange: "Date of change", page: "Page", of: "of", version: "Version",
            createFolder: "Create folder", uploadDocument: "Upload document", refresh: "Refresh", filter: "Filter", loading: "Loading",
            newFolderName: "New folder name", create: "Create", cancel: "Cancel", documents: "Documents",
            upload: "Upload", deleteFolder: "Delete folder", delete: "Delete", areYouSure: "Are you sure ?", deleteDocument: "Delete document",
            close: "Close", documentVersions: "Document versions", updateDocument: "Update document", comment: "Comment",
            dropFilesHere: "Drop files here or click to choose", sorting: "Sorting", sort: "Sort"
        };

        locales['ru-RU'] = locales['ru'] = {
            name: "Имя", author: "Автор", dateOfChange: "Дата изменения", page: "Страница", of: "из", version: "Версия",
            createFolder: "Создать папку", uploadDocument: "Загрузить документ", refresh: "Обновить", filter: "Фильтр", loading: "Загрузка",
            newFolderName: "Имя новой папки", create: "Создать", cancel: "Отмена", documents: "Документы",
            upload: "Загрузить", deleteFolder: "Удалить папку", delete: "Удалить", areYouSure: "Вы уверены ?", deleteDocument: "Удалить документ",
            close: "Закрыть", documentVersions: "Версии документа", updateDocument: "Обновить документ", comment: "Комментарий",
            dropFilesHere: "Перенесите файлы сюда или нажмите для выбора", sorting: "Сортировка", sort: "Сортировать"
        };

        locales['de-de'] = locales['de'] = {
            name: "Name", author: "Autor", dateOfChange: "Datum der Änderung", page: "Seite", of: "von", version: "Fassung",
            createFolder: "Ordner erstellen", uploadDocument: "Dokument hochladen", refresh: "Erneuern", filter: "Filter", loading: "Laden"
        };

        return $.extend({}, locales["en-US"], locales[navigator.language]);
    };

    var template = '<div class="ecmcaption"></div><div class="ecmactions"></div>' +
        '<table class="table table-bordered ecmtable">' +
        '<thead><tr>' +
        '<th width="50%">' + i18n().name + '</th>' +
        '<th width="25%">' + i18n().author + '</th>' +
        '<th width="25%">' + i18n().dateOfChange + '</th>' +
        '</tr></thead><tbody></tbody></table>' +
        '<div class="row ecmpagingdiv"><div class="col-sm-6"><h4 class="ecmpage"></h4></div>' +
        '<div class="col-sm-6"><ul class="pagination ecmpagination"></ul></div></div>' +

//Folder create modal
        '<div class="newfoldermodal modal fade" tabindex="-1">' +
        '<div class="modal-dialog">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().createFolder + '</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div class="form-group newfoldername-form-group">' +
        '<label class="control-label" for="newFolderName">' + i18n().newFolderName + '</label>' +
        '<input type="text" class="form-control">' +
        '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
        '<button type="button" class="btn btn-primary btn-create">' + i18n().create + '</button>' +
        '</div></div></div></div>' +

//Upload document modal
        '<div class="newdocumentmodal modal fade" tabindex="-1">' +
        '<form method="post" enctype="multipart/form-data">' +
        '<div class="modal-dialog modal-lg">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().uploadDocument + '</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div class="form-group uploadform-group newdocument-form-group">' +
        '<label class="control-label">' + i18n().documents + '</label>' +
        '<table class="filetable table table-bordered">' +
        '<thead><tr><th>#</th><th class="filename">Имя</th><th>Размер</th><th>Тип</th><th></th></tr></thead>' +
        '<tbody>' +
        '</tbody>' +
        '</table>' +
        '<div class="ecmdnd noselect">' + i18n().dropFilesHere + '</div>' +
        '<input class="filechooser" type="file" multiple>' +
        '<div class="progress ecmprogress" style="display: none;">' +
        '<div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%">' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
        '<button  type="submit" class="btn btn-primary btn-upload">' + i18n().upload + '</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</form>' +
        '</div>' +

//Delete folder modal
        '<div class="modal fade" id="deleteFolderModal" tabindex="-1">' +
        '<div class="modal-dialog">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().deleteFolder + '</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '<h3>' + i18n().areYouSure + '</h3>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
        '<button type="button" class="btn btn-danger btn-delete">' + i18n().delete + '</button>' +
        '</div></div></div></div>' +

//Delete document modal
        '<div class="modal fade" id="deleteDocumentModal" tabindex="-1">' +
        '<div class="modal-dialog">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().deleteDocument + '</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '<h3>' + i18n().areYouSure + '</h3>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
        '<button type="button" class="btn btn-danger btn-delete">' + i18n().delete + '</button>' +
        '</div></div></div></div>' +

//Document versions modal
        '<div class="modal fade" id="documentVersionsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">' +
        '<div class="modal-header"><button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().documentVersions + '</h4></div>' +
        '<div class="modal-body">' +
        '<table class="table table-bordered versiontable"></table>' +
        '<ul class="pagination versionpagination"></ul>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().close + '</button>' +
        '</div></div></div></div>' +

//Update document modal
        '<div class="modal fade" id="updateDocumentModal" tabindex="-1">' +
        '<div class="modal-dialog">' +
        '<form enctype="multipart/form-data" id="updateForm">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().updateDocument + '</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div class="form-group updatedocumentcomment-form-group">' +
        '<label class="control-label" for="comment">' + i18n().comment + '</label>' +
        '<textarea id="comment" class="form-control" rows="3"></textarea>' +
        '</div>' +
        '<div class="form-group updatedocumentfile-form-group">' +
        '<label class="control-label" for="fileContent">' + i18n().uploadDocument + '</label>' +
        '<input type="file" id="fileContent" name="fileContent"/>' +
        '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
        '<button type="button" class="btn btn-primary btn-update">' + i18n().upload + '</button>' +
        '</div></div>' +
        '</form>' +
        '</div></div>' +

//Sorting modal
        '<div class="modal fade ecmsortingmodal"  tabindex="-1">' +
        '<div class="modal-dialog">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">' + i18n().sorting + '</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
        '<button type="button" class="btn btn-primary btn-update">' + i18n().sort + '</button>' +
        '</div></div>' +
        '</div></div>' +

//Edit document modal
        '<div class="modal fade ecmeditdocumentmodal"  tabindex="-1">' +
        '<div class="modal-dialog">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">Редактирование свойств</h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '<table class="table table-bordered proptable">' +
        '<thead>' +
        '<tr>' +
        '<th class="ecmpropertycol">Name</th>' +
        '<th class="ecmpropertycol">Value</th>' +
        '<th><button type="button" class="btn btn-success btn-add"><span class="glyphicon glyphicon-plus"></span></button></th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '</tbody>' +
        '</table>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-default" data-dismiss="modal">Закрыть</button>' +
        '<button type="button" class="btn btn-primary btn-edit">Записать</button>' +
        '</div></div>' +
        '</div></div>';

    var addToData = function (formData, files) {
        if (formData == null) {
            formData = new FormData();
        }

        $.each(files, function (i, file) {
            var key = 'file_' + file.name;

            if (formData.has(key)) {
                formData.delete(key)
            }

            formData.append(key, file);
        });

        return formData;
    };

    var sprintf = function (str) {
        var args = arguments,
            i = 1;

        str = str.replace(/%s/g, function () {
            var arg = args[i++];

            if (typeof arg === 'undefined') {
                return '';
            }

            return arg;
        });

        return str;
    };

    var filesize = function (size) {
        var result = "";

        var sizeKB = size / 1024;

        if (sizeKB > 1024) {
            var sizeMB = sizeKB / 1024;
            result = sizeMB.toFixed(2) + " MB";
        } else {
            result = sizeKB.toFixed(2) + " KB";
        }

        return result;
    };

    var sortByName = function (a, b) {
        if (typeof a.name == 'undefined' || typeof b.name == 'undefined') return -1;
        var aName = a.name.toLowerCase();
        var bName = b.name.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    };

    var TWDateToString = function (dateStr) {
        if (typeof dateStr == 'undefined') return '';

        var date = new Date(dateStr);

        return date.toLocaleDateString() + '&nbsp;' + date.toLocaleTimeString();
    };

    var pluginName = "ECMBrowser";
    $.fn[pluginName] = function (options) {
        var result = this;

        this.each(function () {
            var _this = $.data(this, pluginName);
            if (typeof options == 'undefined') {
                result = _this;
            } else {
                $.data(this, pluginName, new ECMBrowser(this, $.extend(true, {}, options)));
            }
        });

        return result;
    };


//    var CreateFolderModal = function (rootElement) {
//        this.$root = rootElement;
//
//        this.init();
//    };
//
//    CreateFolderModal.prototype.init = function () {
//        $('body').append(//Folder create modal
//            '<div class="newfoldermodal2 modal fade" tabindex="-1">' +
//            '<div class="modal-dialog">' +
//            '<div class="modal-content">' +
//            '<div class="modal-header">' +
//            '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
//            '<h4 class="modal-title">' + i18n().createFolder + '</h4>' +
//            '</div>' +
//            '<div class="modal-body">' +
//            '<div class="form-group newfoldername-form-group">' +
//            '<label class="control-label" for="newFolderName">' + i18n().newFolderName + '</label>' +
//            '<input type="text" class="form-control">' +
//            '</div>' +
//            '</div>' +
//            '<div class="modal-footer">' +
//            '<button type="button" class="btn btn-default" data-dismiss="modal">' + i18n().cancel + '</button>' +
//            '<button type="button" class="btn btn-primary btn-create">' + i18n().create + '</button>' +
//            '</div></div></div></div>');
//    };
})
(jQuery);
