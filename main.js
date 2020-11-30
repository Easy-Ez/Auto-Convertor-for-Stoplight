// ==UserScript==
// @name         Auto Convertor for Stoplight
// @namespace    https://wecando.cc/
// @version      1.1.0
// @description  try to take over the world!
// @author       sadhu
// @match        https://automizely.stoplight.io/docs/developers-mobile-aftershipapi-com-tracking/*
// @match        https://automizely.stoplight.io/docs/developers-product-automizelyapi-com-shopping/*
// @require		 https://cdn.bootcss.com/jquery/3.2.1/jquery.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@10
// @require      https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.4.0/highlight.min.js
// @require      https://greasyfork.org/scripts/6250-waitforkeyelements/code/waitForKeyElements.js?version=23756
// @resource     IMPORTED_CSS https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.4.0/styles/default.min.css
// @license      GPL License
// @grant        GM_download
// @grant        GM_log
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_getResourceURL
// @grant        GM_getResourceText
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// @connect      oschina.net
// ==/UserScript==

var responseJson;

(function () {
    'use strict';
    // Your code here...
    const my_css = GM_getResourceText("IMPORTED_CSS");
    GM_addStyle(my_css);
    hljs.initHighlightingOnLoad();
    var originalFetch = fetch;

    unsafeWindow.fetch = (input, init) => {

        return originalFetch(input, init).then(response => {
            // it is not important to create new Promise in ctor, we can await existing one, then wrap result into new one
            return new Promise((resolve) => {
                response.clone() // we can invoke `json()` only once, but clone do the trick
                    .json()
                    .then(json => {
                        // do what ever you want with response, even `resolve(new Response(body, options));`
                        if (json.hasOwnProperty("data")) {
                            let data = json.data;
                            if (data.hasOwnProperty("bundledBranchNode")) {
                                try {
                                    responseJson = JSON.parse(data.bundledBranchNode.data);
                                    console.log("================================")
                                    console.log(responseJson)
                                    if (responseJson.responses[0].contents[0].schema.properties.hasOwnProperty("data")) {
                                        waitForKeyElements(".SectionTitle.pl-1.pb-3.text-lg.font-medium.text-gray-7", responseCallbackFunction);
                                    }
                                }
                                catch (err) {
                                    console.log(err)
                                } finally {
                                    resolve(response);
                                }

                            }
                        } else {
                            resolve(response);
                        }

                    });
            });
        });
    };







    GM_addStyle('#myBtn{color: white;width: 100px;height: 36px;background: #3385ff;border-bottom: 1px solid #2d7');
    GM_addStyle('.sweet_custom_content{ text-align: left;}');
    GM_addStyle('.sweet_custom_popup{ width: auto !important;}');
    GM_addStyle('pre{ overflow: auto;min-height: 100px;max-height: 300px;}');
    function responseCallbackFunction(jNode) {
        if (jNode.text() == "Responses") {
            var html = "<input type='button' id='myBtn' value='预览' />";
            jNode.append(html);
            // 定义按钮事件
            $("#myBtn").click(function () {
                let javaCode = generateAndroidBean(false);
                formatJavaCode(javaCode);
            });
        }
    };

    function generateAndroidBean(isKotlin) {
        if (isKotlin) {
            return generateAndroidkotlinBean();
        } else {
            return generateAndroidJavaBean();
        }
    };

    function generateAndroidkotlinBean() {
        return ""
    }

    function generateAndroidJavaBean() {
        let data = responseJson.responses[0].contents[0].schema.properties.data
        let properties
        if (responseJson.responses[0].contents[0].schema.properties.data.hasOwnProperty("properties")) {
            properties = data.properties
        } else if (responseJson.responses[0].contents[0].schema.properties.data.hasOwnProperty("$ref")) {
            properties = getPropertiesJson(data)
        }
        let innerMode = true;
        var output = createJavaClass(generateClassNameByPath(), properties, "")
        return output
    }


    /**
     * 根据请求路径来生成最外层的类名
     *   /tracking/list
     */
    function generateClassNameByPath() {
        return (`${toCamelCaseLetter(responseJson.path)}Data`)
    }

    /**
     *
     * 根据属性名生成类名
     * @param {String}} propertyname
     */
    function generateClassNameByPropertyName(propertyname) {
        var camelString = toCamelCaseLetter(propertyname)
        // 首字母要大写
        if (camelString.length == 1) {
            return `${camelString[0].toUpperCase().toString()}Data`;
        } else {
            return `${camelString[0].toUpperCase().toString() + camelString.substring(1, camelString.length)}Data`;
        }

    }


    /**
     * 创建java类
     * @param {String} className
     * @param {jsonObject} properties
     * @param {String} output
     */
    function createJavaClass(className, properties, output, staticClass = false) {
        if (staticClass) {
            output = `static class ${className} { \n`
        } else {
            output = `class ${className} { \n`
        }

        let result = appendJavaField(properties, output)
        output = result.output
        // 其他的class
        if (result.classInfos.length != 0) {
            for (let i = 0; i < result.classInfos.length; i++) {
                let classInfo = result.classInfos[i];
                if (!isEmpty(classInfo)) {
                    output = output + createJavaClass(classInfo.className, classInfo.propertiesJson, output, true)
                }
            }
        }
        output = output + "}\n"

        return output
    }
    //
    // properties:
    // rates:
    //  items: {type: "object", properties: {…}, required: Array(5)}
    //  type: "array"
    // __proto__: Object

    /**
     * 添加成员变量
     * @param {jsonObject} properties
     * @param {String} output
     */
    function appendJavaField(properties, output) {
        let classInfos = []
        for (var propertyname in properties) {
            output = output + "@SerializedName(\"" + propertyname + "\") \n"
            var propertyJson = properties[propertyname];
            if (isDirectObjectType(propertyJson)) {
                classInfos.push(createInnerClassInfoByDirect(propertyname, propertyJson))
                output = output + `private ${generateClassNameByPropertyName(propertyname)}  ${formatterPropertyName(propertyname)};\n`;
            } else if (isRefObjectType(propertyJson)) {
                classInfos.push(createInnerClassInfoByRef(propertyJson))
                output = output + `private ${convertTypeByRef(propertyJson)}  ${formatterPropertyName(propertyname)};\n`;
            } else if (isArrayType(propertyJson)) {
                var typeString;
                if (isDirectObjectType(propertyJson.items)) {
                    classInfos.push(createInnerClassInfoByDirect(propertyname, propertyJson.items))
                    typeString = generateClassNameByPropertyName(propertyname)
                } else if (isRefObjectType(propertyJson.items)) {
                    classInfos.push(createInnerClassInfoByRef(propertyJson.items))
                    typeString = getClassName(propertyJson.items)
                } else {
                    typeString = convertTypeForList(propertyJson.items.type)
                }
                output = output + `private List<${typeString}> ${formatterPropertyName(propertyname)};\n`;
            } else {
                output = output + `private ${convertType(propertyJson.type)} ${formatterPropertyName(propertyname)};\n`;
            }
        }

        return { output: output, classInfos: classInfos }
    }

    /**
     * 通过引用路径创建内部类信息
     * @param {jsonObject} propertyJson
     */
    function createInnerClassInfoByRef(propertyJson) {
        let refPath = propertyJson["$ref"]
        if (!isEmpty(refPath)) {
            var paths = refPath.split("/")
            var otherClassJson = responseJson
            for (let j = 1; j < paths.length; j++) {
                otherClassJson = otherClassJson[paths[j].replaceAll('~1', '/')];
            }
            if (otherClassJson.hasOwnProperty("type") && otherClassJson.type == "array") {
                return createInnerClassInfoByRef(otherClassJson.items)
            } else {
                return { className: `${paths[paths.length - 1]}Data`, propertiesJson: otherClassJson.properties }
            }
        }

    }

    function getPropertiesJson(propertyJson) {
        let refPath = propertyJson["$ref"]
        if (!isEmpty(refPath)) {
            var paths = refPath.split("/")
            var otherClassJson = responseJson
            for (let j = 1; j < paths.length; j++) {
                otherClassJson = otherClassJson[paths[j].replaceAll('~1', '/')];
            }
            if (otherClassJson.hasOwnProperty("type") && otherClassJson.type == "array") {
                return getPropertiesJson(otherClassJson.items)
            } else {
                return otherClassJson.properties
            }
        }
    }


    /**
     * 通过直接创建内部类信息
     * 
     */
    function createInnerClassInfoByDirect(propertyname, propertyJson) {
        return { className: `${generateClassNameByPropertyName(propertyname)}`, propertiesJson: propertyJson.properties }

    }
    // refJson: {"$ref": "#/__bundled__/components/schemas/Tracking"}
    function getClassName(refJson) {
        var refPath = refJson["$ref"];
        return refPath.substring(refPath.lastIndexOf("/") + 1, refPath.length) + "Data";
    }

    /**
     * object类型的成员变量, 获取实际的类型 可能是List 或者是 object
     * @param {jsonObject} refJson 含有 $ref的jsonObject
     */
    function convertTypeByRef(refJson) {
        let refPath = refJson["$ref"]
        if (!isEmpty(refPath)) {
            var paths = refPath.split("/")
            var otherClassJson = responseJson
            for (let j = 1; j < paths.length; j++) {
                otherClassJson = otherClassJson[paths[j].replaceAll('~1', '/')];
            }
            if (otherClassJson.hasOwnProperty("type") && otherClassJson.type == "array") {
                return `List<${convertTypeByRef(otherClassJson.items)}>`
            } else {
                return getClassName(refJson);
            }

        }
    }
    /**
     * 格式化成员变量
     * 转驼峰然后检测关键词
     * 避免有些成员变量名称是关键词,fix一下
     * @param {String} propertyName 
     */
    function formatterPropertyName(propertyName) {
        var propertyNameMinor = toCamelCaseLetter(propertyName)
        if (propertyNameMinor == 'break' || propertyNameMinor == 'continue' || propertyNameMinor == 'switch') {
            return `${propertyNameMinor}Fix`
        } else {
            return propertyNameMinor;
        }
    }

    // 转换为驼峰风格 is_url => isUrl
    function toCamelCaseLetter(propertyName, specialChars = ['_', '/', '-', ':']) {
        var propertyNameMinor = propertyName
        for (let i = 0; i < specialChars.length; i++) {
            let specialChar = specialChars[i];
            var indexOf = propertyNameMinor.indexOf(specialChar)
            while (indexOf != -1) {
                if (indexOf + 1 < propertyNameMinor.length) {
                    propertyNameMinor = propertyNameMinor.substring(0, indexOf) +
                        propertyNameMinor[indexOf + 1].toUpperCase().toString() +
                        propertyNameMinor.substring(indexOf + 2, propertyNameMinor.length)
                } else {
                    // 去掉_就行
                    propertyNameMinor = propertyNameMinor.substring(0, indexOf)
                }
                indexOf = propertyNameMinor.indexOf(specialChar)
            }
        }
        return propertyNameMinor
    }


    // 类型转换
    function convertType(type) {
        let paramType
        if (isArray(type)) {
            paramType = type[0];
        } else {
            paramType = type;
        }
        var convertType = "";
        if (paramType == "integer") {
            convertType = "int";
        } else if (paramType == "string") {
            convertType = "String";
        } else {
            convertType = paramType;
        }
        return convertType;
    }
    function convertTypeForList(type) {
        var convertType = "";
        if (type == "integer") {
            convertType = "Integer";
        } else if (type == "float") {
            convertType = "Float";
        } else if (type == "double") {
            convertType = "Double";
        } else if (type == "string") {
            convertType = "String";
        } else {
            convertType = type;
        }
        return convertType;
    }


    /**
     *
     * 是否是引用类型的object类型
     * @param {jsonObject}} propertyJson
     */
    function isRefObjectType(propertyJson) {
        return propertyJson.hasOwnProperty("$ref");
    }
    /**
     * 是否是直接定义的objec类型
     * @param {jsonObject} propertyJson
     */
    function isDirectObjectType(propertyJson) {
        return (propertyJson.hasOwnProperty("type") && propertyJson.type == "object");
    }
    function isArrayType(propertyJson) {
        return propertyJson.hasOwnProperty("type") && propertyJson.type == "array"
    }

    function isEmpty(obj) {
        if (typeof obj == "undefined" || obj == null || obj == "") {
            return true;
        } else {
            return false;
        }
    }
    //返回baitrue为Array，false不是array
    function isArray(obj) {
        if (typeof obj == "object" && obj.constructor == Array) {
            return true;
        }
        return false;
    }


    /**
     *
     * 格式化生成的java代码
     * @param {String} jsonCode
     */
    function formatJavaCode(jsonCode) {
        let postData = new FormData();
        postData.append("java", jsonCode);

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://tool.oschina.net/action/format/java",
            data: postData,
            onload: function (response) {
                let rsp = JSON.parse(response.responseText);
                console.log(rsp)
                if (rsp.hasOwnProperty("fjava")) {
                    //GM_setClipboard(rsp.fjava)
                    showConvertResult(rsp.fjava);
                } else {
                    showError();
                }

            }
        });

    }

    function showError() {
        Swal.fire(
            '格式化错误',
            '格式化错误,生成的原始代码有问题, 请联系开发者修复该问题.',
            'error'
        )
    }


    function showConvertResult(text) {
        // 处理选中事件
        function checkField(val) {
            console.log(val)
            GM_setValue('checkboxType', val)
        }

        let footer = `<input type="radio" name="checkboxType" value="Java" >Java<input type="radio" name="checkboxType" value="Kotlin" >Kotlin<input type="radio" name="checkboxType" value="swift" >swift`
        let htmlContent = String.raw`${text}`
        // $("body").append(String.raw`<div id="codeDiv"><pre><code>${hljs.highlightAuto(htmlContent).value}</code></pre></div>`)
        Swal.fire({
            html: '<pre><code id="codelang"></code></pre>',
            icon: 'success',
            showCancelButton: false,
            confirmButtonText: 'Copy',
            footer: footer,
            customClass: {
                popup: 'sweet_custom_popup',
                content: 'sweet_custom_content'
            },
            willOpen: () => {
                // 设置默认选中的radio
                let codeType = GM_getValue('checkboxType')
                if (isEmpty(codeType)) {
                    codeType = 'Java'
                }
                $(`input[name=checkboxType][value=${codeType}]`).attr("checked", 'checked');
                $("input:radio[name='checkboxType']").change(function () {
                    console.log(this.value)
                    GM_setValue('checkboxType', this.value)
                });
                // 高亮格式化代码
                let highCode = hljs.highlightAuto(htmlContent).value;
                $("#codelang").html(highCode);
            }
        }).then((result) => {
            htmlContent = String.raw`import com.google.gson.annotations.SerializedName;
import java.util.List;
${htmlContent}`
            GM_setClipboard(htmlContent)
        })

    }




})();