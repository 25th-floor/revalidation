/* @flow */
import React from 'react'

import createErrorComponent from './createErrorComponent'
import createValidation from '../createValidation'
import {
  assoc,
  assocPath,
  curry,
  map,
  prop,
} from 'ramda'

// default ErrorComponent
const DefaultErrorComponent = ({errorMsg}) => <div className='error'>{errorMsg}</div>

function Revalidation(
  initialState,
  validationRules,
  errorComponent,
  Component
) {

  const validate = createValidation(createErrorComponent(errorComponent || DefaultErrorComponent))

  return class extends React.Component {

    state: {
      form: Object,
      errors: Array<any>,
    }

    onChange: Function

    constructor(props) {
      super(props)
      this.state = initialState
      this.onChange = curry((name, value) =>
        this.setState(state => {
          const newState = assocPath(['form', name], value, state)
          const errors = validate(prop('form', newState), validationRules)
          return assoc('errors', errors, newState)
        })
      )
    }

    render() {
      const {form, errors} = this.state

      return (
        <Component
          {...this.props}
          form={form}
          errors={errors}
          onChange={this.onChange}
        />
      )
    }
  }
}

export default curry(Revalidation)
