import React from 'react'
import { compose, head } from 'ramda'
import Revalidation from 'revalidation'

import helpers from './helpers'

const {
  getValue,
  isNotEmpty,
  isLengthGreaterThan,
  hasCapitalLetter,
  } = helpers

const ErrorComponent = ({errorMsg}) => <div className='error'>{head(errorMsg)}</div>

const Form = ({ reValidation : {form, validate, valid, errors = {}, validateAll}, onSubmit }) =>
  (
    <div className='form'>
      <div className='formGroup'>
        <label>Name</label>
        <input
          type='text'
          className={errors.name ? 'error' : ''}
          value={form.name}
          onChange={compose(validate('name'), getValue)}
        />
        <div className='errorPlaceholder'>{ errors.name }</div>
      </div>
      <div className='formGroup'>
        <label>Random</label>
        <input
          type='text'
          className={errors.random ? 'error' : ''}
          value={form.random}
          onChange={compose(validate('random'), getValue)}
        />
        <div className='errorPlaceholder'>{ errors.random }</div>
      </div>
      <button onClick={() => validateAll(onSubmit)}>Submit</button>
    </div>
  )

const validationRules = {
  name: [
    [isNotEmpty, 'Name should not be  empty.']
  ],
  random: [
    [isLengthGreaterThan(7), 'Minimum Random length of 8 is required.'],
    [hasCapitalLetter, 'Random should contain at least one uppercase letter.'],
  ]
}

const initialState = {}

const enhanced = Revalidation(
  initialState,
  validationRules,
  ErrorComponent,
  {validateSingle: true}
)

export default enhanced(Form)
