import React, { Component } from 'react'
import { Button, TextArea, ButtonGroup, Icon } from "@blueprintjs/core"
import { connect } from 'react-redux'
import { shell } from 'electron'
export const windowMode = false;
const { BrowserWindow } = require('electron').remote;
import './index.css';


const parseShip = (ship) => {
    let tempObj =
    {
        "id": ship.api_ship_id,
        "lv": ship.api_lv,
        "st": ship.api_kyouka,
        "exp": ship.api_exp,
        "ex": ship.api_slot_ex
    }

    if (ship.api_sally_area) {
        tempObj.area = ship.api_sally_area
    }

    return tempObj;
}



const parseEquip = (equip) => {
    let tempObj =
    {
        "id": equip.api_slotitem_id,
        "lv": equip.api_level
    }

    if(equip.api_level == undefined) {
        tempObj.lv = 0;
    }

    return tempObj;
}



//活动海域的 api_area_id 都在 30 以上；常规海域（6-4 / 6-5 也能用陆航）则是 6 之类的小数字
const ACTIVITY_AREA_MIN = 30

//noro6 只会读取 a1~a3，所以一次只能导出一个海域的陆航，且最多 3 队
const MAX_AIRBASE_COUNT = 3

//poi 的 airbase 数组里可能同时存在多个海域的基地，按选中的海域挑出来
const pickAirbases = (airbases, areaId) => {
    if (areaId === '' || areaId == null) return []
    return (airbases || [])
        .filter(airbase => (airbase.api_area_id == undefined ? 0 : airbase.api_area_id) === areaId)
        .slice(0, MAX_AIRBASE_COUNT)
}


const copyToClipboard = (result) => {
    const content = document.createElement('input'),
    text = result;
    document.body.appendChild(content);
    content.value = text;
    content.select();
    document.execCommand('copy');
    document.body.removeChild(content);
}



export const reactClass = connect(state => ({
    hqlv: state.info.basic.api_level,
    fleets: state.info.fleets,
    ships: state.info.ships,
    equips: state.info.equips,
    airbases: state.info.airbase,
    //海域名（6 → 中部海域）与当前出击海域，用于生成下拉选项和默认值
    mapareas: state.const ? state.const.$mapareas : undefined,
    sortieMapId: state.sortie ? state.sortie.sortieMapId : 0
}))(class View extends Component {

    //selectedAirbaseArea 为 null 时表示「跟随当前出击海域」；'' 表示不导出陆航
    state = { result: "", selectedAirbaseArea: null };

    //舰娘资料导出(包含未锁定)
    exportShipsAll = () => {
        const ships = this.props.ships;
        let result = []
        Object.keys(ships).forEach((key) => {
            const ship = ships[key]
            result.push(parseShip(ship))
        })
        let strResult = JSON.stringify(result)
        this.setState({ result: strResult })
        copyToClipboard(strResult)
        return result;
    }

    //舰娘资料导出(不包含未锁定)
    exportShipsLocked = () => {
        const ships = this.props.ships;
        let result = []
        Object.values(ships)
            .filter(ship => {
                return ship.api_locked == "1"
            }).forEach(ship => {
                result.push(parseShip(ship))
            })
        let strResult = JSON.stringify(result)
        this.setState({ result: strResult })
        copyToClipboard(strResult)
        return result;
    }

    //装备资料导出(包含未锁定)
    exportEquipsAll = () => {
        const equips = this.props.equips;
        let result = [];
        Object.keys(equips).forEach((key) => {
            const equip = equips[key];
            if (equip) {
                if (equip.api_level === undefined) {
                    result.push({ "id": equip.api_slotitem_id, "lv": 0 });
                } else {
                    result.push({ "id": equip.api_slotitem_id, "lv": equip.api_level });
                }
            }
        });
        let strResult = JSON.stringify(result);
        this.setState({ result: strResult });
        copyToClipboard(strResult);
        return result;
    }

    //装备资料导出(不包含未锁定)
    exportEquipsLocked = () => {
        const equips = this.props.equips;
        //按实例 id 的键顺序遍历会因为取最大 id 当上界而漏掉 id 最大的那件装备，
        //这里直接遍历所有实例，不依赖 id 是否连续
        const result = Object.values(equips)
            .filter(equip => equip && equip.api_locked != 0)
            .map(parseEquip)
        const strResult = JSON.stringify(result)

        this.setState({ result: strResult })
        copyToClipboard(strResult)
        return strResult;
    }

    //把陆航按 api_area_id 分组（poi 的 airbase 数组里可能同时存在 6 图和 7 图的基地）
    getAirbaseGroups = () => {
        const airbases = this.props.airbases || []
        const groups = new Map()
        airbases.forEach(airbase => {
            const areaId = airbase.api_area_id == undefined ? 0 : airbase.api_area_id
            if (!groups.has(areaId)) groups.set(areaId, [])
            groups.get(areaId).push(airbase)
        })
        return Array.from(groups.entries())
            .map(([areaId, list]) => ({ areaId, list }))
            .sort((a, b) => a.areaId - b.areaId)
    }

    //当前出击的海域 id（sortieMapId 是「海域+图号」拼成的，例如 75 → 7、621 → 62）
    getSortieAreaId = () => {
        const sortieMapId = Number(this.props.sortieMapId)
        if (!sortieMapId) return null
        return Math.floor(sortieMapId / 10)
    }

    //没手动选过就跟随当前出击海域；当前海域没有陆航就不导出（免得拿别图的基地算出错的制空）
    resolveAirbaseArea = (groups) => {
        if (this.state.selectedAirbaseArea != null) return this.state.selectedAirbaseArea
        const areas = groups.map(group => group.areaId)
        const sortieArea = this.getSortieAreaId()
        if (sortieArea != null) {
            return areas.indexOf(sortieArea) !== -1 ? sortieArea : ''
        }
        //不在出击中（sortieMapId 为 0）时退回第一个有陆航的海域
        return areas.length ? areas[0] : ''
    }

    //下拉选项文案：6 图 · 中部海域（3 队）
    getAirbaseAreaLabel = (group) => {
        const mapareas = this.props.mapareas || {}
        const name = mapareas[group.areaId] && mapareas[group.areaId].api_name
        const prefix = group.areaId >= ACTIVITY_AREA_MIN ? `活动 ${group.areaId}` : `${group.areaId} 图`
        const count = group.list.length > MAX_AIRBASE_COUNT
            ? `仅前 ${MAX_AIRBASE_COUNT} 队`
            : `${group.list.length} 队`
        return `${prefix}${name ? ' · ' + name : ''}（${count}）`
    }

    handleAirbaseAreaChange = (event) => {
        const { value } = event.target
        this.setState({ selectedAirbaseArea: value === '' ? '' : Number(value) })
    }

    //舰队编成JSON生成
    refreshFleetText = () => {
        const fleets = this.props.fleets;
        const ships = this.props.ships;
        const equips = this.props.equips;
        const airbases = this.props.airbases;
        let result = `{"version": 4,"hqlv":${this.props.hqlv},`;

        for (let i = 0; i < fleets.length; i++) {
            const fleet = fleets[i];
            result += `"f${i + 1}":{`;
            for (let j = 0; j < fleet.api_ship.length; j++) {
                if (ships[fleet.api_ship[j]]) {
                    const ship = ships[fleet.api_ship[j]];
                    result += `"s${j + 1}":{"id":${ship.api_ship_id},"lv":${ship.api_lv},"luck":${ship.api_lucky[0]},"items":{`;
                    for (let k = 0; k < ship.api_slot.length; k++) {
                        const slot = ship.api_slot[k];
                        if (equips[slot]) {
                            const equip = equips[slot];
                            result += `"i${k + 1}":{"id":${equip.api_slotitem_id},"rf":${equip.api_level}`
                            if (equip.api_alv) result += `,"mas":${equip.api_alv}`
                            result += `},`
                        }
                    }
                    if (equips[ship.api_slot_ex]) {
                        const equip = equips[ship.api_slot_ex]
                        result += `"ix":{"id":${equip.api_slotitem_id},"rf":${equip.api_level}`
                        if (equip.api_alv) result += `,"mas":${equip.api_alv}`
                        result += `}`
                    }
                    if (result.charAt(result.length - 1) == ',') {
                        result = result.slice(0, result.length - 1) + `}`
                    } else {
                        result += `}`
                    }
                    result += `},`
                }
            }
            if (result.charAt(result.length - 1) == ',') {
                result = result.slice(0, result.length - 1) + `},`
            } else {
                result += `},`
            }
        }

        const airbaseArea = this.resolveAirbaseArea(this.getAirbaseGroups());
        const airbaseList = pickAirbases(airbases, airbaseArea);
        let airbase_cnt = 0;
        for (let i = 0; i < airbaseList.length; i++) {
            const airbase = airbaseList[i];
            airbase_cnt += 1;
            result += `"a${airbase_cnt}":{"items": {`;
            for (let j = 0; j < airbase.api_plane_info.length; j++) {
                const plane = airbase.api_plane_info[j];
                if (equips[plane.api_slotid]) {
                    const equip = equips[plane.api_slotid]
                    result += `"i${j + 1}":{"id":${equip.api_slotitem_id},"rf":${equip.api_level}`
                    if (equip.api_alv) result += `,"mas":${equip.api_alv}`
                    result += `},`
                }
            }
            if (result.charAt(result.length - 1) == ',') {
                result = result.slice(0, result.length - 1) + `},`
            } else {
                result += `},`
            }
            result += `"mode":${airbase.api_action_kind}},`
        }

        if (result.charAt(result.length - 1) == ',') {
            result = result.slice(0, result.length - 1) + `}`
        } else {
            result += `}`
        }

        this.setState({ result })
        return result;
    }

    //导出舰队编成至noro6 (使用内置窗口)
    exportNoro6Fleet = () => {
        const result = this.refreshFleetText()
        this.openOrFocusNoro6Window(`https://noro6.github.io/kc-web/?predeck=${result}`)
    }

    exportJervis = () => {
        const result = this.refreshFleetText()
        shell.openExternal(`https://jervis.vercel.app/zh-CN/?predeck=${result}`)
    }

    openOrFocusNoro6Window = (url) => {
        if (this.noro6Window && !this.noro6Window.isDestroyed()) {
            this.noro6Window.loadURL(url);
            this.noro6Window.focus();
        } else {
            this.noro6Window = new BrowserWindow({ show: false });
            this.noro6Window.loadURL(url);
            this.noro6Window.maximize();
            this.noro6Window.on('closed', () => {
                this.noro6Window = null;
            });
        }
    }

    openNewPage = () => {
        const ships = this.exportShipsAll();
        const equips = this.exportEquipsAll();
        const encodedShips = JSON.stringify(ships);
        const encodedEquips = JSON.stringify(equips);
        const url = `https://noro6.github.io/kc-web#import:{"predeck":{},"ships":${encodedShips},"items":${encodedEquips}}`;
        
        this.openOrFocusNoro6Window(url);
    }

    copyUrl = () => {
        const ships = this.exportShipsAll();
        const equips = this.exportEquipsAll();
        const encodedShips = JSON.stringify(ships);
        const encodedEquips = JSON.stringify(equips);
        const url = `https://noro6.github.io/kc-web#import:{"predeck":{},"ships":${encodedShips},"items":${encodedEquips}}`;
        copyToClipboard(url);
    }



    render() {
        const result = this.state.result;
        const airbaseGroups = this.getAirbaseGroups();
        return (
            <div>
                <h2>舰队导出与管理</h2>

                <div className="buttonGroup">
                    <div className="group">
                        <h4>内置窗口操作</h4>
                        <Button className="primaryButton" onClick={this.openNewPage}>
                            打开制空权模拟器
                        </Button>
                    </div>

                    <div className="group">
                        <h4>外部链接操作</h4>
                        <Button className="secondaryButton" onClick={this.copyUrl}>
                            复制导出链接
                        </Button>
                    </div>
                </div>

                <div className="section">
                    <h4>单独数据导出</h4>
                    
                    <div className="buttonGroup">
                        <Button className="secondaryButton" style={{width: '48%'}} onClick={this.exportShipsAll}>
                            舰娘：包含未锁定
                        </Button>
                        
                        <Button className="secondaryButton" style={{width: '48%'}} onClick={this.exportShipsLocked}>
                            舰娘：仅限已锁定
                        </Button>
                    </div>

                    <div className="buttonGroup">
                        <Button className="secondaryButton" style={{width: '48%'}} onClick={this.exportEquipsAll}>
                            装备：包含未锁定
                        </Button>

                        <Button className="secondaryButton" style={{width: '48%'}} onClick={this.exportEquipsLocked}>
                            装备：仅限已锁定
                        </Button>
                    </div>
                </div>

                <br />

                <div className="section">
                    <h4>舰队编成导出</h4>
                    <div className="fleetButtonGroup">
                        <Button className="primaryButton fleetButton" onClick={this.exportNoro6Fleet}>
                            导出至 noro6
                        </Button>
                        <Button className="primaryButton fleetButton" onClick={this.exportJervis}>
                            导出至 jervis
                        </Button>
                        <Button className="secondaryButton fleetButton" onClick={this.refreshFleetText}>
                            刷新编成文本
                        </Button>
                    </div>
                    
                    <div className="optionsRow">
                        <label className="optionsLabel">
                            陆航来源
                            <select
                                className="areaSelect"
                                value={this.resolveAirbaseArea(airbaseGroups)}
                                onChange={this.handleAirbaseAreaChange}
                                disabled={airbaseGroups.length === 0}
                            >
                                <option value="">不导出陆航</option>
                                {airbaseGroups.map(group => (
                                    <option key={group.areaId} value={group.areaId}>
                                        {this.getAirbaseAreaLabel(group)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {airbaseGroups.length === 0 && <span className="optionsHint">暂无陆航数据</span>}
                    </div>
                    
                    <h4>编成 JSON 文本</h4>
                    <div className="textAreaContainer">
                        <TextArea style={{ height: "120px" }} placeholder="点击上方按钮生成文本" className="bp3-fill" fill={true} value={this.state.result} readOnly={true}></TextArea>
                    </div>
                </div>
            </div>
        )
    }
})