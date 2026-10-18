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

//api_combined_flag / noro6 的 FLEET_TYPE 是同一套编号
const FLEET_TYPE_NAMES = { 1: '機動部隊', 2: '水上打撃部隊', 3: '輸送護衛部隊' }

const pad2 = (value) => (value < 10 ? `0${value}` : `${value}`)

//noro6 只接受数字；改修情报缺失等情况下 api_level 会是 undefined，这里统一兜成 0
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

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
    //海域名（6 → 中部海域），用于生成陆航下拉的选项文案
    mapareas: state.const ? state.const.$mapareas : undefined,
    //连合舰队形式（1 机动 / 2 水上 / 3 输送），0 表示没有连合
    combinedFlag: state.sortie ? state.sortie.combinedFlag : 0
}))(class View extends Component {

    //selectedAirbaseArea 为 '' 表示不导出陆航（默认），否则是要导出的 api_area_id
    //fleetMode 自动时按连合 / 7舰第3舰队 / 第1舰队 依次判断；手动时按 manualFleets 勾选
    state = {
        result: "",
        summary: "",
        selectedAirbaseArea: '',
        fleetMode: "auto",
        manualFleets: [true, true, true, true],
        stockMode: "shipsAll"
    };

    //舰娘所持数据；lockedOnly 时只要已上锁的（输出的是舰种 id）
    buildShipStock = (lockedOnly) => {
        const ships = this.props.ships || {}
        return Object.values(ships)
            .filter(ship => ship && (!lockedOnly || ship.api_locked == 1))
            .map(parseShip)
    }

    //装备所持数据；lockedOnly 时只要已上锁的
    buildEquipStock = (lockedOnly) => {
        const equips = this.props.equips || {}
        return Object.values(equips)
            .filter(equip => equip && (!lockedOnly || equip.api_locked != 0))
            .map(parseEquip)
    }

    //把下拉选中的舰娘/装备数据直接复制到剪贴板（不动下方文本域）
    copyStock = () => {
        const { stockMode } = this.state
        const lockedOnly = stockMode.indexOf('Locked') !== -1
        const isShips = stockMode.indexOf('ships') === 0
        const data = isShips ? this.buildShipStock(lockedOnly) : this.buildEquipStock(lockedOnly)
        copyToClipboard(JSON.stringify(data))
        if (typeof window.toast === 'function') {
            window.toast(`已复制 ${data.length} ${isShips ? '只舰娘' : '件装备'}`)
        }
    }

    handleStockModeChange = (event) => {
        this.setState({ stockMode: event.target.value })
    }

    copyResult = () => {
        const { result } = this.state
        if (!result) return
        copyToClipboard(result)
        if (typeof window.toast === 'function') window.toast('已复制到剪贴板')
    }

    clearResult = () => {
        this.setState({ result: '', summary: '' })
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

    getFleet = (index) => {
        const fleets = this.props.fleets || []
        return fleets[index]
    }

    fleetHasShips = (index) => {
        const fleet = this.getFleet(index)
        return !!(fleet && fleet.api_ship && fleet.api_ship.some(id => id > 0))
    }

    //連合艦隊形式（1 機動 / 2 水上 / 3 輸送）；第 2 艦隊沒船時不認為是連合
    getCombinedType = () => {
        const flag = Number(this.props.combinedFlag)
        if (flag !== 1 && flag !== 2 && flag !== 3) return 0
        return this.fleetHasShips(1) ? flag : 0
    }

    //第 3 艦隊 7 格全滿 = 遊撃部隊／水雷戦隊
    isGuerrillaFleet = () => {
        const fleet = this.getFleet(2)
        const apiShip = (fleet && fleet.api_ship) || []
        return apiShip.length === 7 && apiShip.every(id => id > 0)
    }

    //自动模式：連合 > 第3艦隊(7舰) > 第1艦隊；手动模式：忠实序号，不带連合标记
    resolveFleetPlan = () => {
        if (this.state.fleetMode !== 'manual') {
            const combinedType = this.getCombinedType()
            if (combinedType) return { indices: [0, 1], combinedType, auto: true }
            if (this.isGuerrillaFleet()) return { indices: [2], combinedType: 0, auto: true }
            return { indices: [0], combinedType: 0, auto: true }
        }
        const indices = []
        this.state.manualFleets.forEach((checked, index) => {
            if (checked) indices.push(index)
        })
        return { indices, combinedType: 0, auto: false }
    }

    getFleetPlanHint = (plan) => {
        if (!plan.auto) {
            if (!plan.indices.length) return '未选择舰队，将只导出陆航'
            const labels = plan.indices.map(index => `第${index + 1}`).join(' + ')
            const tabHint = plan.indices[0] === 0 ? '' : `；noro6 默认打开第1艦隊，请切到第${plan.indices[0] + 1}艦隊`
            return `手动：${labels}艦隊${tabHint}`
        }
        if (plan.combinedType) {
            return `自动：連合艦隊（${FLEET_TYPE_NAMES[plan.combinedType]}）→ 第1 + 第2艦隊`
        }
        if (plan.indices[0] === 2) {
            return '自动：第3艦隊（7 舰编成）→ 遊撃部隊；noro6 默认打开第1艦隊，请切到第3艦隊'
        }
        return '自动：第1艦隊'
    }

    handleFleetModeChange = (event) => {
        this.setState({ fleetMode: event.target.value })
    }

    handleManualFleetChange = (index, checked) => {
        const manualFleets = this.state.manualFleets.slice()
        manualFleets[index] = checked
        this.setState({ manualFleets })
    }

    //刷新后的一行摘要，省得每次去比对整段 JSON
    buildRefreshSummary = (fleetParts, airbaseCount) => {
        const now = new Date()
        const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
        const total = fleetParts.reduce((sum, part) => sum + part.ships, 0)
        const fleetsText = fleetParts.length
            ? fleetParts.map(part => `f${part.index + 1} ${part.ships}`).join(' / ')
            : '无舰队'
        const airbaseText = airbaseCount ? `陆航 a1~a${airbaseCount}` : '陆航 无'
        return `已刷新 · ${total} 舰（${fleetsText}）· ${airbaseText} · ${time}`
    }

    //舰队编成JSON生成
    refreshFleetText = () => {
        const fleets = this.props.fleets || [];
        const ships = this.props.ships;
        const equips = this.props.equips;
        const airbases = this.props.airbases;
        const fleetPlan = this.resolveFleetPlan();
        const fleetParts = [];
        let result = `{"version": 4,"hqlv":${num(this.props.hqlv)},`;

        for (let p = 0; p < fleetPlan.indices.length; p++) {
            const i = fleetPlan.indices[p];
            const fleet = fleets[i];
            //空舰队没有导出价值，直接跳过
            if (!fleet || !fleet.api_ship || !this.fleetHasShips(i)) continue;
            let shipCount = 0;
            result += `"f${i + 1}":{`;
            //連合标记只能挂在第 1 艦隊上，noro6 以此判断 f1+f2 是否合并
            if (fleetPlan.combinedType && i === 0) result += `"t":${fleetPlan.combinedType},`;
            for (let j = 0; j < fleet.api_ship.length; j++) {
                if (ships[fleet.api_ship[j]]) {
                    const ship = ships[fleet.api_ship[j]];
                    shipCount += 1;
                    result += `"s${j + 1}":{"id":${num(ship.api_ship_id)},"lv":${num(ship.api_lv)},"luck":${num(ship.api_lucky && ship.api_lucky[0])},"items":{`;
                    for (let k = 0; k < ship.api_slot.length; k++) {
                        const slot = ship.api_slot[k];
                        if (equips[slot]) {
                            const equip = equips[slot];
                            result += `"i${k + 1}":{"id":${num(equip.api_slotitem_id)},"rf":${num(equip.api_level)}`
                            if (equip.api_alv) result += `,"mas":${equip.api_alv}`
                            result += `},`
                        }
                    }
                    if (equips[ship.api_slot_ex]) {
                        const equip = equips[ship.api_slot_ex]
                        result += `"ix":{"id":${num(equip.api_slotitem_id)},"rf":${num(equip.api_level)}`
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
            fleetParts.push({ index: i, ships: shipCount });
        }

        const airbaseArea = this.state.selectedAirbaseArea;
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
                    result += `"i${j + 1}":{"id":${num(equip.api_slotitem_id)},"rf":${num(equip.api_level)}`
                    if (equip.api_alv) result += `,"mas":${equip.api_alv}`
                    result += `},`
                }
            }
            if (result.charAt(result.length - 1) == ',') {
                result = result.slice(0, result.length - 1) + `},`
            } else {
                result += `},`
            }
            result += `"mode":${num(airbase.api_action_kind)}},`
        }

        if (result.charAt(result.length - 1) == ',') {
            result = result.slice(0, result.length - 1) + `}`
        } else {
            result += `}`
        }

        this.setState({ result, summary: this.buildRefreshSummary(fleetParts, airbase_cnt) })
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
        //noro6 的 #import: 只带所持数据（编成走「导出至 noro6」）
        const url = `https://noro6.github.io/kc-web#import:${JSON.stringify({
            predeck: {},
            ships: this.buildShipStock(false),
            items: this.buildEquipStock(false)
        })}`;

        this.openOrFocusNoro6Window(url);
    }



    render() {
        const result = this.state.result;
        const airbaseGroups = this.getAirbaseGroups();
        const fleetPlan = this.resolveFleetPlan();
        return (
            <div>
                <h2>舰队导出与管理</h2>

                <div className="topRow">
                    <div className="topCol">
                        <h4>内置窗口操作</h4>
                        <Button className="primaryButton" onClick={this.openNewPage}>
                            打开制空权模拟器
                        </Button>
                    </div>

                    <div className="topCol">
                        <h4>单独数据导出</h4>
                        <div className="inlineRow">
                            <select
                                className="areaSelect stockSelect"
                                value={this.state.stockMode}
                                onChange={this.handleStockModeChange}
                            >
                                <option value="shipsAll">舰娘：包含未锁定</option>
                                <option value="shipsLocked">舰娘：仅限已锁定</option>
                                <option value="equipsAll">装备：包含未锁定</option>
                                <option value="equipsLocked">装备：仅限已锁定</option>
                            </select>
                            <Button className="secondaryButton inlineButton" onClick={this.copyStock}>
                                复制
                            </Button>
                        </div>
                    </div>
                </div>

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
                    
                    <div className="optionsGrid">
                        <label className="optionsLabel">
                            舰队范围
                            <select
                                className="areaSelect"
                                value={this.state.fleetMode}
                                onChange={this.handleFleetModeChange}
                            >
                                <option value="auto">自动（連合 / 遊撃 / 第1艦隊）</option>
                                <option value="manual">手动选择舰队</option>
                            </select>
                        </label>
                        <label className="optionsLabel">
                            陆航来源
                            <select
                                className="areaSelect"
                                value={this.state.selectedAirbaseArea}
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
                    </div>

                    {airbaseGroups.length === 0 && (
                        <div className="optionsHint">暂无陆航数据，陆航不会被导出</div>
                    )}

                    {this.state.fleetMode === 'manual' && (
                        <div className="optionsRow">
                            {[0, 1, 2, 3].map(index => (
                                <label className="optionsLabel" key={index}>
                                    <input
                                        type="checkbox"
                                        checked={this.state.manualFleets[index]}
                                        onChange={event => this.handleManualFleetChange(index, event.target.checked)}
                                    />
                                    第{index + 1}舰队
                                </label>
                            ))}
                        </div>
                    )}

                    <div className="optionsHint fleetHint">{this.getFleetPlanHint(fleetPlan)}</div>
                    {this.state.summary && (
                        <div className="optionsHint refreshSummary">{this.state.summary}</div>
                    )}

                    <div className="resultHeader">
                        <h4>JSON 文本</h4>
                        <div className="resultActions">
                            <Button
                                className="secondaryButton copyButton"
                                onClick={this.copyResult}
                                disabled={!result}
                            >
                                复制
                            </Button>
                            <Button
                                className="secondaryButton copyButton"
                                onClick={this.clearResult}
                                disabled={!result}
                            >
                                清空
                            </Button>
                        </div>
                    </div>
                    <div className="textAreaContainer">
                        <TextArea style={{ height: "120px" }} placeholder="点击上方按钮生成文本" className="bp3-fill" fill={true} value={this.state.result} readOnly={true}></TextArea>
                    </div>
                </div>
            </div>
        )
    }
})