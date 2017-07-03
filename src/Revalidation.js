/* @flow */
/* eslint-disable no-nested-ternary, no-unneeded-ternary */
import React, { createElement } from 'react'
import {
  always,
  assoc,
  assocPath,
  curry,
  ifElse,
  is,
  keys,
  map,
  mergeDeepRight,
  partial,
  prop,
  propOr,
  reduce,
  zipObj,
} from 'ramda'
import hoistNonReactStatics from 'hoist-non-react-statics'
import validate from './validate'
import isValid from './utils/isValid'
import debounce from './helpers/debounce'
import updateFormValues from './updaters/updateFormValues'
import updateSyncErrors from './updaters/updateSyncErrors'

import { UPDATE_FIELD, UPDATE_ALL, VALIDATE_FIELD, VALIDATE_ALL } from './constants'

/**
 * Calculates the new state to be set depending on the actions triggered via the form.
 *
 * Can be an entry point for externally changing the state in future versions, by defining own update functions that
 * change the next state depending on certain user actions. For now this is only an internal implementation.
 *
 * @param {Array} updateFns all update functions that need to change to the current state
 * @param {Object} state the actual state
 * @param {String} type defines which action should be handled via the update functions
 * @param {Object} enhancedProps containing the props as well as additional information like field name or value if available
 * @returns {Object} return the new state that needs to be set.
 */
const runUpdates = (updateFns, state, type, enhancedProps) => reduce((updatedState, updateFn) =>
  updateFn(updatedState, type, enhancedProps), state, updateFns)

/**
 * Maps an empty array to every item of the list and returns a map representing the items as keys
 * Also works with deep nested data.
 *
 * @param {Array} obj the to object to convert
 * @returns {Array}
 * @example
 *
 *    initializeErrors({'a': null 'b': null}) //=> {a: [], b: []}
 *
 *    initializeErrors: [{'a': null, b: {c: {d: null}}}] //=> {'a': [], b: {c: {d: []}}}
 *
 */
const initializeErrors = obj => map(ifElse(is(Object), partial(initializeErrors, []), always([])), obj)

/**
 * revalidation expects a React Component and returns a React Component containing additional functions and props
 * for managing local component state as well validating that state, wrapping the originally provided Component.
 */
function revalidation(
  Component:any // eslint-disable-line comma-dangle
):any {
  class HigherOrderFormComponent extends React.Component {
    state:{
      form: Object,
      errors: Object,
      asyncErrors: Object,
    }

    props:{
      initialState: Object,
      rules: Object,
      asyncErrors?: Object,
      validateSingle?: boolean,
      validateOnChange?: boolean,
      updateForm?: Object
    }

    static defaultProps = {
      initialState: {},
      validateSingle: true,
      validateOnChange: true,
    }

    updateFns: Array<Function> = [updateFormValues, updateSyncErrors]

    constructor(props) {
      super(props)

      const form = propOr([], 'initialState', props)
      const initErrors = initializeErrors(form)

      this.state = {
        form,
        errors: initErrors,
        asyncErrors: initErrors,
        debounceFns: this.createDebounceFunctions(prop('initialState', props)),
        submitted: false,
      }
    }

    componentWillReceiveProps(nextProps) {
      const { updateForm, asyncErrors = {} } = nextProps
      const type = this.getValidateOnChange(this.props.validateOnChange)
        ? [UPDATE_ALL, VALIDATE_ALL]
        : [UPDATE_ALL]

      this.setState((state, props) => {
        const nextState = updateForm
          ? runUpdates(this.updateFns, state, type, { ...props, value: updateForm })
          : state

        const updatedState = assoc('asyncErrors', mergeDeepRight(prop('asyncErrors', state), asyncErrors), nextState)
        return updatedState
      })
    }

    createDebounceFunctions(form: Array<Object>) {
      return zipObj(keys(form),
        map(name => debounce(name, this.updateValue, this.runAsync), keys(form)) // eslint-disable-line comma-dangle
      )
    }

    update = (type, data = {}, cb = () => {}) => {
      this.setState(
        (state, props) =>
          runUpdates(this.updateFns, state, type, { ...props, ...data }),
        cb // eslint-disable-line comma-dangle
      )
    }

    validateAll = (cb: Function, data: Object):void => {
      this.update(
        [VALIDATE_ALL],
        {},
        () => { if (isValid(this.state.errors) && cb) cb(data || this.state.form) } // eslint-disable-line comma-dangle
      )
    }

    updateState = (nextState: Object) => {
      const type = this.getValidateOnChange(this.props.validateOnChange)
        ? [UPDATE_ALL, VALIDATE_ALL]
        : [UPDATE_ALL]

      this.update(type, { value: nextState })
    }

    updateValue = curry((name:string|Array<string|number>, value:any, type: Array<string> = null):void => {
      const updateType =
        this.getValidateOnChange(this.props.validateOnChange)
          ? type
            ? type
            : this.props.validateSingle
              ? [UPDATE_FIELD, VALIDATE_FIELD]
              : [UPDATE_FIELD, VALIDATE_ALL]
          : [UPDATE_FIELD]

      const fieldName = typeof name === 'string' ? [name] : name
      this.update(updateType, { name: fieldName, value })
    })

    onChange = curry((name:string|Array<string|number>, value:any): void => {
      this.updateValue(name, value, [UPDATE_FIELD])
    })

    runAsync = (asyncFn: Function, name: Array<string>|string, value: any): void => {
      // clear the current async errors for the field
      const fieldName = typeof name === 'string' ? [name] : name
      this.setState(state => assocPath(['asyncErrors', ...fieldName], [], state))
      asyncFn(value, this.state)
    }

    getValidateOnChange = (validateOnChange) => is(Function, validateOnChange)
      ? validateOnChange({ submitted: this.state.submitted })
      : validateOnChange

    render() {
      const { form, errors, asyncErrors, debounceFns, submitted } = this.state
      /* eslint-disable no-unused-vars */
      const { rules, asyncRules, initialState, updateForm, validateSingle, validateOnChange, ...rest } = this.props
      const valid = isValid(validate(rules, form)) && isValid(errors)

      const revalidationProp = {
        form,
        errors,
        asyncErrors,
        valid,
        submitted,
        run: this.run,
        debounce: debounceFns,
        updateState: this.updateState,
        onChange: this.updateValue,
        onSubmit: this.validateAll,
        settings: { validateOnChange: this.getValidateOnChange(validateOnChange), validateSingle },
        UPDATE_FIELD,
        VALIDATE: validateSingle ? VALIDATE_FIELD : VALIDATE_ALL,
      }

      return createElement(Component, {
        ...rest,
        revalidation: revalidationProp,
      })
    }
  }

  HigherOrderFormComponent.displayName = `Revalidation_(${Component.displayName || Component.name || 'Component'})`
  return hoistNonReactStatics(HigherOrderFormComponent, Component)
}

export default revalidation
